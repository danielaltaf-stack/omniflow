'use client'

import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { motion } from 'framer-motion'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { User, Mail, Lock } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { PasswordStrength } from '@/components/ui/password-strength'
import { useAuthStore } from '@/stores/auth-store'

const registerSchema = z
  .object({
    name: z.string().min(2, 'Le nom doit contenir au moins 2 caractères'),
    email: z.string().email('Email invalide'),
    password: z
      .string()
      .min(8, 'Au moins 8 caractères')
      .regex(/[A-Z]/, 'Au moins une majuscule')
      .regex(/\d/, 'Au moins un chiffre')
      .regex(
        /[!@#$%^&*(),.?":{}|<>_\-+=\[\]\\;'/`~]/,
        'Au moins un caractère spécial'
      ),
    password_confirm: z.string(),
  })
  .refine((data) => data.password === data.password_confirm, {
    message: 'Les mots de passe ne correspondent pas',
    path: ['password_confirm'],
  })

type RegisterForm = z.infer<typeof registerSchema>

export default function RegisterPage() {
  const router = useRouter()
  const { register: registerUser, isLoading, error, setError } = useAuthStore()

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<RegisterForm>({
    resolver: zodResolver(registerSchema),
  })

  const password = watch('password', '')

  const onSubmit = async (data: RegisterForm) => {
    try {
      await registerUser(data)
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
        Créer votre compte
      </h1>
      <p className="mt-1 text-sm text-foreground-secondary">
        Commencez à unifier votre patrimoine en 2 minutes.
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
            label="Nom complet"
            type="text"
            placeholder="Jean Dupont"
            icon={<User className="h-4 w-4" />}
            error={errors.name?.message}
            {...register('name', { onChange: () => setError(null) })}
          />
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
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
          transition={{ delay: 0.15 }}
          className="space-y-2"
        >
          <Input
            label="Mot de passe"
            type="password"
            placeholder="••••••••"
            icon={<Lock className="h-4 w-4" />}
            error={errors.password?.message}
            {...register('password', { onChange: () => setError(null) })}
          />
          <PasswordStrength password={password} />
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <Input
            label="Confirmer le mot de passe"
            type="password"
            placeholder="••••••••"
            icon={<Lock className="h-4 w-4" />}
            error={errors.password_confirm?.message}
            {...register('password_confirm', {
              onChange: () => setError(null),
            })}
          />
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
        >
          <Button type="submit" isLoading={isLoading} className="w-full">
            Créer mon compte
          </Button>
        </motion.div>
      </form>

      <p className="mt-6 text-center text-sm text-foreground-secondary">
        Déjà un compte ?{' '}
        <Link
          href="/login"
          className="font-medium text-brand hover:text-brand-light transition-colors"
        >
          Se connecter
        </Link>
      </p>
    </motion.div>
  )
}
