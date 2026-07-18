import type { Member } from '@/utils/treeTypes'

export function seedMembers(): Member[] {
  return [
    // ═══════════════════════════════════════
    // Gen 0 — 祖辈 (placeholder ancestors)
    // ═══════════════════════════════════════
    {
      id: 'gf',
      name: '铭誌',
      gender: 1,
      isAlive: false,
      spouses: [{ spouseId: 'gm', marriageOrder: 1, marriageType: '元配' }],
    },
    {
      id: 'gm',
      name: '祖母',
      gender: 2,
      isAlive: false,
      spouses: [{ spouseId: 'gf', marriageOrder: 1, marriageType: '元配' }],
    },

    // ═══════════════════════════════════════
    // Gen 1 — 永康及兄弟辈
    // ═══════════════════════════════════════

    // 兄A (placeholder, brother of 永康)
    {
      id: 'xa',
      name: '兄A',
      gender: 1,
      isAlive: false,
      fatherId: 'gf',
      motherId: 'gm',
      spouses: [],
    },

    // 永康
    {
      id: 'yk',
      name: '永康',
      gender: 1,
      birthYear: 1903,
      deathYear: 1970,
      isAlive: false,
      biography:
        '字克强，仁型公长孙、铭誌公长子。省立遵义第三中学毕业，弱冠从戎，任军需官、经理处处长，累迁贵州省财政厅厅长。1970年8月16日卒，享年67。一生四娶，育六子一女。',
      fatherId: 'gf',
      motherId: 'gm',
      spouses: [
        { spouseId: 'cs', marriageOrder: 1, marriageType: '元配' },
        { spouseId: 'ts', marriageOrder: 2, marriageType: '次配' },
        { spouseId: 'xs', marriageOrder: 3, marriageType: '三配' },
        { spouseId: 'xiao', marriageOrder: 4, marriageType: '末配' },
      ],
    },

    // 陈氏 (元配)
    {
      id: 'cs',
      name: '陈氏',
      gender: 2,
      isAlive: false,
      biography: '泗渡陈家湾富庶之家女，永康公元配。长居板桥祖宅，独居持家，躬亲教养长子树烈。',
      spouses: [{ spouseId: 'yk', marriageOrder: 1, marriageType: '元配' }],
    },

    // 唐氏 (次配)
    {
      id: 'ts',
      name: '唐氏',
      gender: 2,
      isAlive: false,
      biography: '讳佩琼，贵阳世宦名族之闺秀，永康公次配。出身勋贵，惜天年不永，婚后未久早逝，育次子树达。',
      spouses: [{ spouseId: 'yk', marriageOrder: 2, marriageType: '次配' }],
    },

    // 徐氏 (三配)
    {
      id: 'xs',
      name: '徐氏',
      gender: 2,
      birthYear: 1917,
      deathYear: 1946,
      isAlive: false,
      biography:
        '讳元书，遵义丁字口人氏，家世业药业，开设仁寿堂药铺。1917年2月7日生，毕业于遵义女子中学。1946年3月4日病逝，年仅29，育树陆、树炎。',
      spouses: [{ spouseId: 'yk', marriageOrder: 3, marriageType: '三配' }],
    },

    // 肖氏 (末配)
    {
      id: 'xiao',
      name: '肖氏',
      gender: 2,
      deathYear: 1954,
      isAlive: false,
      biography: '讳恭散，仁怀中枢望族女，永康公末配。育树艺、树牧、树森。1954年染疾辞世。',
      spouses: [{ spouseId: 'yk', marriageOrder: 4, marriageType: '末配' }],
    },

    // 兄B + 嫂 (placeholder)
    {
      id: 'xb',
      name: '兄B',
      gender: 1,
      isAlive: false,
      fatherId: 'gf',
      motherId: 'gm',
      spouses: [{ spouseId: 'sao', marriageOrder: 1, marriageType: '元配' }],
    },
    {
      id: 'sao',
      name: '嫂',
      gender: 2,
      isAlive: false,
      spouses: [{ spouseId: 'xb', marriageOrder: 1, marriageType: '元配' }],
    },

    // ═══════════════════════════════════════
    // Gen 2 — 树字辈
    // ═══════════════════════════════════════

    // 兄A之子 (placeholder)
    {
      id: 'x',
      name: 'X',
      gender: 1,
      isAlive: false,
      fatherId: 'xa',
      spouses: [],
    },

    // 树烈 (永康长子，陈氏出)
    {
      id: 'sl',
      name: '树烈',
      gender: 1,
      isAlive: false,
      biography: '永康公长子，元配陈氏所出，随母居于乡里，守持家业。',
      fatherId: 'yk',
      motherId: 'cs',
      spouses: [],
    },

    // 树达 (永康次子，唐氏出)
    {
      id: 'sd',
      name: '树达',
      gender: 1,
      isAlive: false,
      biography: '永康公次子，次配唐氏所出，母早逝，幼失慈荫。',
      fatherId: 'yk',
      motherId: 'ts',
      spouses: [],
    },

    // 树陆 (永康三子，徐氏出)
    {
      id: 'slu',
      name: '树陆',
      gender: 1,
      isAlive: false,
      biography: '永康公三子，三配徐氏所出，各有承嗣，自立于世。',
      fatherId: 'yk',
      motherId: 'xs',
      spouses: [],
    },

    // 树炎 (永康四子，徐氏出)
    {
      id: 'sy',
      name: '树炎',
      gender: 1,
      birthYear: 1944,
      isAlive: true,
      biography:
        '讳树炎，永康公第四子，徐氏所出。1944年9月17日生于贵阳。毕业于遵义市第四中学，历任教员、施工员、财务科长、厂长等职。2005年告老。一生两娶：1975年娶杨光莉，1985年续娶万晓丽。',
      fatherId: 'yk',
      motherId: 'xs',
      spouses: [
        { spouseId: 'yang', marriageOrder: 1, marriageType: '元配' },
        { spouseId: 'wan', marriageOrder: 2, marriageType: '继配' },
      ],
    },

    // 杨氏 (树炎元配)
    {
      id: 'yang',
      name: '杨氏',
      gender: 2,
      isAlive: true,
      biography: '讳光莉，贵阳人氏，树炎公元配。博学知礼，终身从教。1975年与树炎结婚，育一女熙杨，1982年离异。',
      spouses: [{ spouseId: 'sy', marriageOrder: 1, marriageType: '元配' }],
    },

    // 万氏 (树炎继配)
    {
      id: 'wan',
      name: '万氏',
      gender: 2,
      birthYear: 1959,
      isAlive: true,
      biography: '讳晓丽，遵义人氏，树炎公继配。1959年11月16日生，入职遵义市第二建筑总公司，累迁至财务科长，2019年荣休。1985年续娶树炎，育一子熙涵。',
      spouses: [{ spouseId: 'sy', marriageOrder: 2, marriageType: '继配' }],
    },

    // 树艺 (永康长女，肖氏出)
    {
      id: 'syi',
      name: '树艺',
      gender: 2,
      isAlive: false,
      biography: '永康公长女，末配肖氏所出。',
      fatherId: 'yk',
      motherId: 'xiao',
      spouses: [],
    },

    // 树牧 (永康五子，肖氏出)
    {
      id: 'sm',
      name: '树牧',
      gender: 1,
      isAlive: false,
      biography: '永康公第五子，末配肖氏所出，又名王茂秋。',
      fatherId: 'yk',
      motherId: 'xiao',
      spouses: [],
    },

    // 树森 (永康六子，肖氏出)
    {
      id: 'ss',
      name: '树森',
      gender: 1,
      isAlive: false,
      fatherId: 'yk',
      motherId: 'xiao',
      spouses: [{ spouseId: 'gjl', marriageOrder: 1, marriageType: '元配' }],
    },

    // 葛金莲 (树森之妻)
    {
      id: 'gjl',
      name: '葛金莲',
      gender: 2,
      isAlive: true,
      spouses: [{ spouseId: 'ss', marriageOrder: 1, marriageType: '元配' }],
    },

    // 兄B之子女 (placeholder)
    {
      id: 'y',
      name: 'Y',
      gender: 1,
      isAlive: false,
      fatherId: 'xb',
      motherId: 'sao',
      spouses: [],
    },
    {
      id: 'z',
      name: 'Z',
      gender: 2,
      isAlive: false,
      fatherId: 'xb',
      motherId: 'sao',
      spouses: [],
    },

    // ═══════════════════════════════════════
    // Gen 3 — 熙字辈
    // ═══════════════════════════════════════

    // 熙杨 (树炎之女，杨氏出)
    {
      id: 'xy',
      name: '熙杨',
      gender: 2,
      birthYear: 1976,
      isAlive: true,
      biography: '树炎公之女，杨氏所出。1976年3月4日生于遵义。1994年考入武汉大学专修国际法，现供职《贵州商报》编辑部。',
      fatherId: 'sy',
      motherId: 'yang',
      spouses: [],
    },

    // 熙涵 (树炎之子，万氏出)
    {
      id: 'xh',
      name: '熙涵',
      gender: 1,
      birthYear: 1986,
      isAlive: true,
      biography:
        '树炎公幼子，万氏所出。1986年4月3日生于遵义。毕业于内蒙古科技大学新闻学。2009年考取公职，历任办公室主任、中队长、支委。2013年配夏凡，育二女舜君、舜珵。',
      fatherId: 'sy',
      motherId: 'wan',
      spouses: [{ spouseId: 'xf', marriageOrder: 1, marriageType: '元配' }],
    },

    // 夏凡 (熙涵之妻)
    {
      id: 'xf',
      name: '夏凡',
      gender: 2,
      birthYear: 1987,
      isAlive: true,
      biography: '熙涵之妻，1987年2月12日生于遵义。毕业于贵州师范大学外语系。2011年考录新蒲新区第一小学任英语教师。',
      spouses: [{ spouseId: 'xh', marriageOrder: 1, marriageType: '元配' }],
    },

    // ═══════════════════════════════════════
    // Gen 4 — 舜字辈
    // ═══════════════════════════════════════

    // 廖舜君 (熙涵长女)
    {
      id: 'lsj',
      name: '廖舜君',
      gender: 2,
      birthYear: 2015,
      isAlive: true,
      biography: '熙涵长女，2015年10月1日生于遵义，现就读新蒲新区第一小学。',
      fatherId: 'xh',
      motherId: 'xf',
      spouses: [],
    },

    // 廖舜珵 (熙涵次女)
    {
      id: 'lsc',
      name: '廖舜珵',
      gender: 2,
      birthYear: 2018,
      isAlive: true,
      biography: '熙涵次女，2018年12月1日生于遵义，现就读新蒲新区第一小学。',
      fatherId: 'xh',
      motherId: 'xf',
      spouses: [],
    },
  ]
}
