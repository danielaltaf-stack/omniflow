'use client'

import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { motion } from 'framer-motion'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Mail, Lock } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useAuthStore } from '@/stores/auth-store'

const loginSchema = z.object({
  email: z.string().email('Email invalide'),
  password: z.string().min(1, 'Mot de passe requis'),
})

type LoginForm = z.infer<typeof loginSchema>

export default function LoginPage() {
  const router = useRouter()
  const { login, isLoading, error, setError } = useAuthStore()

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
  })

  const onSubmit = async (data: LoginForm) => {
    try {
      await login(data)
      router.push('/dashboard')
    } catch {
      // error is set in the store
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
    >
      <h1 className="text-2xl font-bold text-foreground">
        Content de vous revoir
      </h1>
      <p className="mt-1 text-sm text-foreground-secondary">
        Connectez-vous pour accéder à votre patrimoine.
      </p>

      <form onSubmit={handleSubmit(onSubmit)} className="mt-8 space-y-5">
        {error && (
          <motion.div
            className="rounded-omni-sm border border-loss/30 bg-loss/10 px-4 py-3 text-sm text-loss"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
          >
            {error}
          </motion.div>
        )}

        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
        >
          <Input
            label="Email"
            type="email"
            placeholder="you@example.com"
            icon={<Mail className="h-4 w-4" />}
            error={errors.email?.message}
            {...register('email', { onChange: () => setError(null) })}
          />
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <Input
            label="Mot de passe"
            type="password"
            placeholder="••••••••"
            icon={<Lock className="h-4 w-4" />}
            error={errors.password?.message}
            {...register('password', { onChange: () => setError(null) })}
          />
        </motion.div>

        <div className="flex items-center justify-end">
          <Link
            href="#"
            className="text-xs text-brand hover:text-brand-light transition-colors"
          >
            Mot de passe oublié ?
          </Link>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
        >
          <Button type="submit" isLoading={isLoading} className="w-full">
            Se connecter
          </Button>
        </motion.div>
      </form>

      <p className="mt-6 text-center text-sm text-foreground-secondary">
        Pas encore de compte ?{' '}
        <Link
          href="/register"
          className="font-medium text-brand hover:text-brand-light transition-colors"
        >
          Créer un compte
        </Link>
      </p>
    </motion.div>
  )
}
