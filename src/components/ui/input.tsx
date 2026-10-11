import * as React from "react"
import { Input as InputPrimitive } from "@base-ui/react/input"
import { cn } from "cn"
function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return <InputPrimitive type={type} data-slot="input" className={cn("h-10 w-full min-w-0 rounded-xl border border-[#dbe5f0] bg-white px-3 text-sm text-[#17213f] shadow-sm outline-none transition placeholder:text-slate-400 focus:border-[#1f86df] focus:ring-4 focus:ring-[#1f86df]/10 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:opacity-60", className)} {...props} />
}
export { Input }
