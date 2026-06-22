import { getInitials } from "@/lib/umbra"

interface AvatarProps {
  name: string
  size?: number
  className?: string
}

export function Avatar({ name, size = 32, className = "" }: AvatarProps) {
  return (
    <span
      className={`agent-avatar-sm ${className}`.trim()}
      style={size !== 32 ? { width: size, height: size, fontSize: size * 0.36 } : undefined}
      aria-hidden
    >
      {getInitials(name)}
    </span>
  )
}
