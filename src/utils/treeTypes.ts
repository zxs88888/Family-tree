export interface Member {
  id: string
  name: string
  gender: 1 | 2 // 1=男 2=女
  birthYear?: number
  deathYear?: number
  isAlive: boolean
  biography?: string
  fatherId?: string
  motherId?: string
  spouses: SpouseRelation[]
  children?: Member[]
}

export interface SpouseRelation {
  spouseId: string
  marriageOrder: number
  marriageType: string // 元配/次配/三配/继配
}

export interface LayoutNode {
  id: string
  name: string
  cx: number
  cy: number
  r: number
  gender: 1 | 2
  isRoot?: boolean
  birthYear?: number
  deathYear?: number
}

export interface LayoutLine {
  x1: number
  y1: number
  x2: number
  y2: number
  type: 'marriage' | 'parent-child'
}

export interface TreeLayout {
  nodes: LayoutNode[]
  lines: LayoutLine[]
  viewBox: { width: number; height: number }
}
