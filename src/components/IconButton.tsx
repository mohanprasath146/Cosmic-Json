import clsx from 'clsx'
import type { ButtonHTMLAttributes, ComponentType } from 'react'

type IconButtonVariant = 'chip' | 'ghost' | 'tab'

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  icon: ComponentType<{ size?: number; className?: string }>
  title: string
  active?: boolean
  variant?: IconButtonVariant
  size?: number
}

export function IconButton({
  icon: Icon,
  title,
  active = false,
  variant = 'ghost',
  className,
  type = 'button',
  size = 18,
  ...props
}: IconButtonProps) {
  return (
    <button
      {...props}
      type={type}
      title={title}
      aria-label={title}
      className={clsx('icon-button', `${variant}-button`, active && 'is-active', className)}
    >
      <Icon size={size} />
    </button>
  )
}
