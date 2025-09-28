import { GalleryVerticalEnd } from "lucide-react"
import { AuthGuard } from "@/components/auth-guard"
import { LoginForm } from "@/components/login/login-form"
import Image from "next/image"
export default function LoginPage() {
  return (
    <AuthGuard requireAuth={false}>
      <div className="grid min-h-svh lg:grid-cols-2">
        <div className="flex flex-col gap-4 p-6 md:p-10">
          <div className="flex justify-center gap-2 md:justify-start">
            <a href="#" className="flex items-center gap-2 font-medium">
              <div className="bg-primary text-primary-foreground flex size-6 items-center justify-center rounded-md">
                <Image src="/favicon.ico" alt="NexPass" width={24} height={24} />
              </div>
              NexPass
            </a>
          </div>
          <div className="flex flex-1 items-center justify-center">
            <div className="w-full max-w-xs">
              <LoginForm />
            </div>
          </div>
        </div>
        <div className="bg-muted relative hidden lg:block">
          <img
            src="/login-placeholder.png"
            alt="Image"
            className="absolute inset-0 h-full w-full object-cover dark:brightness-[0.2] dark:grayscale"
          />
        </div>
      </div>
    </AuthGuard>
  )
}
