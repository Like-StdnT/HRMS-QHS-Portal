import * as React from "react"
import { cn } from "cn"

function Card({ className, size = "default", ...props }: React.ComponentProps<"div"> & { size?: "default" | "sm" }) {
  return <div data-slot="card" data-size={size} className={cn("group/card flex flex-col overflow-hidden rounded-2xl border border-[#dbe5f0] bg-white text-sm text-[#17213f] shadow-[0_8px_30px_rgba(20,36,91,.055)]", className)} {...props} />
}
function CardHeader({ className, ...props }: React.ComponentProps<"div">) { return <div data-slot="card-header" className={cn("grid auto-rows-min items-start gap-1 px-5 pb-1 pt-5", className)} {...props} /> }
function CardTitle({ className, ...props }: React.ComponentProps<"div">) { return <div data-slot="card-title" className={cn("text-base font-bold leading-snug text-[#14245b]", className)} {...props} /> }
function CardDescription({ className, ...props }: React.ComponentProps<"div">) { return <div data-slot="card-description" className={cn("text-sm leading-5 text-slate-500", className)} {...props} /> }
function CardAction({ className, ...props }: React.ComponentProps<"div">) { return <div data-slot="card-action" className={cn("col-start-2 row-span-2 row-start-1 self-start justify-self-end", className)} {...props} /> }
function CardContent({ className, ...props }: React.ComponentProps<"div">) { return <div data-slot="card-content" className={cn("px-5 pb-5 pt-3", className)} {...props} /> }
function CardFooter({ className, ...props }: React.ComponentProps<"div">) { return <div data-slot="card-footer" className={cn("flex items-center border-t border-[#e6edf5] bg-slate-50/70 p-5", className)} {...props} /> }
export { Card, CardHeader, CardFooter, CardTitle, CardAction, CardDescription, CardContent }
