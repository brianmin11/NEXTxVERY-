export type CoordinationProposal = {
  summary: string
  date: string
  startTime: string
  endTime: string
}
export type CoordinationPreview = CoordinationProposal & {
  unsupportedReasons: string[]
}
export type CoordinationRoom = {
  id: string
  revision: number
  familyId: string
  creatorId: string
  parties: string[]
  event: {
    id: string
    revision: number
    title: string
    date: string
    startTime: string
    endTime: string
  }
  status:
    "open" | "proposed" | "deferred" | "declined" | "applied" | "withdrawn"
  contributions: { actorId: string; text: string; revision: number }[]
  proposal: (CoordinationProposal & { version: number; digest: string }) | null
  decisions: {
    actorId: string
    decision: "accept" | "defer" | "decline"
    digest: string
  }[]
  createdAt: string
  expiresAt: string
  resultEventRevision?: number
}
