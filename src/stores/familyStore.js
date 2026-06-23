import { defineStore } from 'pinia'
import { supabase } from '@/utils/supabase'
import { buildGraphData } from '@/utils/graphHelper'

export const useFamilyStore = defineStore('family', {
  state: () => ({
    allMembers: [],
    graphData: { nodes: [], links: [] },
    loading: false,
    loaded: false,
    isEmpty: true,
    eventsCache: {},
  }),
  actions: {
    async withAutoRefresh(queryFn) {
      try {
        return await queryFn()
      } catch (error) {
        if (error?.message?.includes('JWT expired') || error?.status === 403) {
          await supabase.auth.signInAnonymously()
          return await queryFn()
        }
        throw error
      }
    },
    async loadAllMembers(familyId) {
      this.loading = true
      const { data, error } = await this.withAutoRefresh(async () => {
        return await supabase
          .from('members')
          .select('*')
          .eq('family_id', familyId)
          .eq('is_deleted', false)
      })
      if (error) throw error
      this.allMembers = data || []
      this.isEmpty = this.allMembers.length === 0
      this.loaded = true
      this.loading = false
      return this.allMembers
    },
    async addMember(payload) {
      const { data, error } = await supabase
        .from('members')
        .insert({
          family_id: payload.family_id,
          name: payload.name,
          gender: payload.gender || null,
          birth_year: payload.birth_year || null,
          death_year: payload.is_alive ? null : (payload.death_year || null),
          is_alive: payload.is_alive !== false,
          biography: payload.biography || null,
          father_id: payload.father_id || null,
          mother_id: payload.mother_id || null,
          spouse_id: payload.spouse_id || null,
        })
        .select()
        .single()
      if (error) throw error
      this.allMembers.push(data)
      this.isEmpty = false

      // 配偶双向同步：设置反向关系
      if (data.spouse_id) {
        await supabase.from('members').update({ spouse_id: data.id }).eq('id', data.spouse_id)
      }

      return data
    },
    async updateMember(id, payload) {
      const { data: oldData } = await supabase
        .from('members')
        .select('spouse_id')
        .eq('id', id)
        .single()
      const oldSpouseId = oldData?.spouse_id
      const newSpouseId = payload.spouse_id || null

      // 配偶双向同步：解除旧配偶
      if (oldSpouseId && oldSpouseId !== newSpouseId) {
        await supabase.from('members').update({ spouse_id: null }).eq('id', oldSpouseId)
      }

      // 更新当前成员
      const updateData = {
        name: payload.name,
        gender: payload.gender || null,
        birth_year: payload.birth_year || null,
        death_year: payload.is_alive === false ? (payload.death_year || null) : null,
        is_alive: payload.is_alive !== false,
        biography: payload.biography || null,
        father_id: payload.father_id || null,
        mother_id: payload.mother_id || null,
        spouse_id: newSpouseId,
      }

      const { data, error } = await supabase
        .from('members')
        .update(updateData)
        .eq('id', id)
        .select()
        .single()
      if (error) throw error

      // 设置新配偶的反向关系：先清空新配偶的旧配偶
      if (newSpouseId) {
        const { data: newSpouse } = await supabase
          .from('members').select('spouse_id').eq('id', newSpouseId).single()
        if (newSpouse?.spouse_id && newSpouse.spouse_id !== id) {
          await supabase.from('members').update({ spouse_id: null }).eq('id', newSpouse.spouse_id)
        }
        await supabase.from('members').update({ spouse_id: id }).eq('id', newSpouseId)
      }

      const idx = this.allMembers.findIndex(m => m.id === id)
      if (idx !== -1) this.allMembers[idx] = data
      return data
    },
    async deleteMember(id) {
      const { error } = await supabase
        .from('members')
        .update({ is_deleted: true })
        .eq('id', id)
      if (error) throw error
      this.allMembers = this.allMembers.filter(m => m.id !== id)
      if (this.allMembers.length === 0) this.isEmpty = true
    },
    // ---- 事件 CRUD ----
    parseYearSort(yearDisplay) {
      let yearSort = null
      const eraMatch = yearDisplay?.match(/(\d{4})\s*年代/)
      if (eraMatch) {
        yearSort = parseInt(eraMatch[1]) + 5
      } else {
        const shortEraMatch = yearDisplay?.match(/(\d{2})\s*年代/)
        if (shortEraMatch) {
          yearSort = 1900 + parseInt(shortEraMatch[1]) + 5
        } else {
          const numMatch = yearDisplay?.match(/(\d{4})/)
          if (numMatch) yearSort = parseInt(numMatch[1])
        }
      }
      return yearSort
    },
    async addEvent(memberId, eventData) {
      const payload = {
        member_id: memberId,
        event_type_label: eventData.event_type_label || null,
        event_title: eventData.event_title,
        year_display: eventData.year_display,
        year_sort: eventData.year_sort ?? this.parseYearSort(eventData.year_display),
        location: eventData.location || null,
        description: eventData.description || null,
        sort_order: eventData.sort_order ?? 0,
      }
      const { data: event, error } = await supabase
        .from('life_events')
        .insert(payload)
        .select()
        .single()
      if (error) throw error

      // 检查是否第一个事件 → 清空 biography
      const { count } = await supabase
        .from('life_events')
        .select('*', { count: 'exact', head: true })
        .eq('member_id', memberId)
      if (count === 1) {
        await supabase.from('members').update({ biography: null }).eq('id', memberId)
        const idx = this.allMembers.findIndex(m => m.id === memberId)
        if (idx !== -1) this.allMembers[idx].biography = null
      }

      this.clearEventsCache(memberId)
      return event
    },
    async updateEvent(eventId, memberId, eventData) {
      const payload = {
        event_type_label: eventData.event_type_label ?? undefined,
        event_title: eventData.event_title,
        year_display: eventData.year_display,
        year_sort: eventData.year_sort ?? this.parseYearSort(eventData.year_display),
        location: eventData.location ?? undefined,
        description: eventData.description ?? undefined,
        sort_order: eventData.sort_order ?? 0,
      }
      const { data, error } = await supabase
        .from('life_events')
        .update(payload)
        .eq('id', eventId)
        .select()
        .single()
      if (error) throw error
      this.clearEventsCache(memberId)
      return data
    },
    async deleteEvent(eventId, memberId) {
      // 1. 查询关联的媒体文件
      const { data: mediaList } = await supabase
        .from('member_media').select('media_url').eq('event_id', eventId)

      // 2. 删除 member_media 记录
      const { error: mediaError } = await supabase.from('member_media').delete().eq('event_id', eventId)
      if (mediaError) throw mediaError

      // 3. 删除 life_events 记录
      const { error: eventError } = await supabase.from('life_events').delete().eq('id', eventId)
      if (eventError) throw eventError

      // 4. 删除 Storage 文件（DB 删除成功后清理）
      if (mediaList?.length > 0) {
        const { extractStoragePath } = await import('@/utils/imageUtils')
        const paths = mediaList.map(m => extractStoragePath(m.media_url)).filter(Boolean)
        if (paths.length > 0) {
          await supabase.storage.from('family_photos').remove(paths)
        }
      }

      // 5. 清空缓存
      this.clearEventsCache(memberId)
    },
    async loadMemberTimeline(memberId) {
      if (this.eventsCache[memberId]) {
        return JSON.parse(JSON.stringify(this.eventsCache[memberId]))
      }
      const { data, error } = await this.withAutoRefresh(async () => {
        return await supabase
          .from('life_events')
          .select('*, images:member_media(*)')
          .eq('member_id', memberId)
          .order('year_sort', { ascending: false, nullsLast: true })
          .order('sort_order', { ascending: true })
      })
      if (error) throw error
      data?.forEach(event => {
        if (event.images?.length > 0) {
          event.images.sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0))
        }
      })
      this.eventsCache[memberId] = data || []
      return JSON.parse(JSON.stringify(this.eventsCache[memberId]))
    },
    clearEventsCache(memberId) {
      if (memberId) {
        delete this.eventsCache[memberId]
      } else {
        this.eventsCache = {}
      }
    },
    buildGraph(centerId, depth = 3) {
      this.graphData = buildGraphData(this.allMembers, centerId, depth)
    },
    async refresh(familyId) {
      this.clearEventsCache()
      await this.loadAllMembers(familyId)
    },
    // ---- 图片上传 ----
    async uploadEventImage(memberId, eventId, tempFilePath, fileName) {
      const { uploadImage } = await import('@/utils/imageUtils')
      const { path, publicUrl } = await uploadImage(memberId, eventId, tempFilePath, fileName)

      const { data, error } = await supabase
        .from('member_media')
        .insert({
          member_id: memberId,
          event_id: eventId,
          media_url: publicUrl,
          media_type: 'image',
          caption: '',
          sort_order: 0,
        })
        .select()
        .single()
      if (error) {
        // 回滚 Storage
        await supabase.storage.from('family_photos').remove([path])
        throw error
      }

      this.clearEventsCache(memberId)
      return data
    },
    async deleteEventImage(imageId, mediaUrl, memberId) {
      // 先删 DB 记录，再删 Storage 文件（避免 Storage 删除成功但 DB 删除失败时的孤立记录）
      const { error } = await supabase.from('member_media').delete().eq('id', imageId)
      if (error) throw error

      const { extractStoragePath } = await import('@/utils/imageUtils')
      const storagePath = extractStoragePath(mediaUrl)
      if (storagePath) {
        await supabase.storage.from('family_photos').remove([storagePath])
      }

      this.clearEventsCache(memberId)
    },
    async updateImageCaption(imageId, caption, memberId) {
      const { error } = await supabase
        .from('member_media')
        .update({ caption: caption || '' })
        .eq('id', imageId)
      if (error) throw error
      this.clearEventsCache(memberId)
    },
  },
})
