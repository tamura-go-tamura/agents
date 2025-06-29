import Image from 'next/image'
import { cn } from '@/lib/utils'

interface LogoProps {
  size?: number
  className?: string
  showText?: boolean
  textSize?: 'sm' | 'md' | 'lg' | 'xl'
}

export function Logo({ 
  size = 32, 
  className, 
  showText = false,
  textSize = 'md'
}: LogoProps) {
  const textSizeClasses = {
    sm: 'text-sm',
    md: 'text-base',
    lg: 'text-lg',
    xl: 'text-xl'
  }

  return (
    <div className={cn("flex items-center space-x-2", className)}>
      <Image 
        src="/logo.png" 
        alt="SafeComm AI" 
        width={size} 
        height={size} 
        className={`h-${size/4} w-${size/4}`}
      />
      {showText && (
        <span className={cn("font-semibold text-gray-800", textSizeClasses[textSize])}>
          チョットマッタ AI
        </span>
      )}
    </div>
  )
}

export default Logo
