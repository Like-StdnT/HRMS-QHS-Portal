import { Button as ButtonPrimitive } from "@base-ui/react/button"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "cn"

const buttonVariants = cva(
  "inline-flex shrink-0 items-center justify-center gap-2 rounded-xl border text-sm font-semibold whitespace-nowrap transition-all outline-none disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg]:size-4",
  {
    variants: {
      variant: {
        default: "border-transparent bg-[#1f86df] text-white shadow-sm hover:bg-[#1678d2] hover:-translate-y-px",
        outline: "border-[#cfe0ee] bg-white text-[#17213f] hover:border-[#a9c7df] hover:bg-[#f5faff]",
        secondary: "border-transparent bg-[#eaf5ff] text-[#1264ac] hover:bg-[#dff0ff]",
        ghost: "border-transparent bg-transparent text-slate-600 hover:bg-slate-50 hover:text-[#14245b]",
        destructive: "border-transparent bg-red-50 text-red-600 hover:bg-red-100",
        link: "border-transparent bg-transparent px-0 text-[#1678d2] underline-offset-4 hover:underline",
      },
      size: { default: "h-10 px-4", xs: "h-7 px-2 text-xs", sm: "h-9 px-3 text-xs", lg: "h-11 px-5", icon: "size-10", "icon-xs": "size-7", "icon-sm": "size-8", "icon-lg": "size-11" },
    },
    defaultVariants: { variant: "default", size: "default" },
  }
)
function Button({ className, variant = "default", size = "default", ...props }: ButtonPrimitive.Props & VariantProps<typeof buttonVariants>) {
  return <ButtonPrimitive data-slot="button" className={cn(buttonVariants({ variant, size, className }))} {...props} />
}
export { Button, buttonVariants }
