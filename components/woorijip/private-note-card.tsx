import { Lock, Send } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"

type PrivateNoteCardProps = {
  /** 작성자만 보는 원문 */
  original: string
  /** 작성자가 승인해야만 전달되는 문장. 없으면 아직 다듬지 않은 상태 */
  outgoing?: string
  recipientName: string
  actions?: React.ReactNode
}

/**
 * 비공개 원문과 전달용 문장을 분리해서 보여주는 틀.
 * 원문은 절대 상대에게 보이지 않고, 전달은 작성자의 승인으로만 일어난다.
 * 상대의 속마음을 추정하는 내용은 이 카드에 넣지 않는다.
 */
export function PrivateNoteCard({ original, outgoing, recipientName, actions }: PrivateNoteCardProps) {
  return (
    <Card>
      <CardHeader>
        <Badge variant="secondary" className="h-6 gap-1.5 px-2.5">
          <Lock aria-hidden="true" />
          나만 볼 수 있는 공간이에요
        </Badge>
        <CardTitle className="pt-1">{recipientName}에게 하고 싶은 말</CardTitle>
      </CardHeader>
      <CardContent className="gap-4">
        <section aria-label="비공개 원문" className="flex flex-col gap-1.5">
          <h3 className="text-sm font-medium text-muted-foreground">내가 쓴 원문 · 비공개</h3>
          <p className="rounded-lg bg-muted p-3 leading-relaxed">{original}</p>
        </section>
        <Separator />
        <section aria-label="전달할 문장" className="flex flex-col gap-1.5">
          <h3 className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground">
            <Send className="size-3.5" aria-hidden="true" />
            {recipientName}에게 전달할 문장
          </h3>
          {outgoing ? (
            <p className="rounded-lg border border-border p-3 leading-relaxed">{outgoing}</p>
          ) : (
            <p className="rounded-lg border border-dashed border-input p-3 text-sm text-muted-foreground">
              아직 전달할 문장이 없어요
            </p>
          )}
          <p className="text-sm text-muted-foreground">내가 확인하고 보내기 전에는 전달되지 않아요.</p>
        </section>
      </CardContent>
      {actions && <CardFooter className="flex-wrap gap-2">{actions}</CardFooter>}
    </Card>
  )
}
