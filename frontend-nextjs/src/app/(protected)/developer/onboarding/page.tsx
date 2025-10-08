'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Check, Code, Key, Rocket, BookOpen, PlayCircle } from 'lucide-react'
import Link from 'next/link'
import {
  loadOnboardingProgress,
  saveOnboardingProgress,
  resetOnboardingProgress,
  getProgressPercentage,
  isOnboardingComplete,
} from '@/lib/onboarding/persistence'

const steps = [
  {
    id: 1,
    title: 'Generate API Key',
    description: 'Create your first API key to authenticate requests',
    icon: Key,
    action: 'Go to API Keys',
    href: '/developer/api-keys',
    completed: false,
  },
  {
    id: 2,
    title: 'Install SDK',
    description: 'Install the TurtleTrading SDK in your project',
    icon: Code,
    action: 'View Installation',
    href: '/docs',
    completed: false,
  },
  {
    id: 3,
    title: 'Make First Request',
    description: 'Test your API key with a simple request',
    icon: PlayCircle,
    action: 'Try Playground',
    href: '/developer/playground',
    completed: false,
  },
  {
    id: 4,
    title: 'Read Documentation',
    description: 'Learn about available endpoints and features',
    icon: BookOpen,
    action: 'View Docs',
    href: '/docs',
    completed: false,
  },
  {
    id: 5,
    title: 'Build Your App',
    description: 'Start building with AI-powered market insights',
    icon: Rocket,
    action: 'View Examples',
    href: '/docs',
    completed: false,
  },
]

export default function OnboardingPage() {
  const [completedSteps, setCompletedSteps] = useState<Set<number>>(new Set())
  const [isLoaded, setIsLoaded] = useState(false)

  // Load progress from localStorage on mount
  useEffect(() => {
    const savedProgress = loadOnboardingProgress()
    setCompletedSteps(savedProgress)
    setIsLoaded(true)
  }, [])

  // Save progress to localStorage whenever it changes
  useEffect(() => {
    if (isLoaded) {
      saveOnboardingProgress(completedSteps)
    }
  }, [completedSteps, isLoaded])

  const toggleStep = (stepId: number) => {
    setCompletedSteps(prev => {
      const newSet = new Set(prev)
      if (newSet.has(stepId)) {
        newSet.delete(stepId)
      } else {
        newSet.add(stepId)
      }
      return newSet
    })
  }

  const handleReset = () => {
    if (confirm('Are you sure you want to reset your onboarding progress?')) {
      resetOnboardingProgress()
      setCompletedSteps(new Set())
    }
  }

  const progress = getProgressPercentage(completedSteps, steps.length)
  const isComplete = isOnboardingComplete(completedSteps, steps.length)

  return (
    <div className="container mx-auto py-8 px-4 max-w-4xl">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Welcome to TurtleTrading!</h1>
        <p className="text-muted-foreground">
          Get started with our AI-powered trading API in 5 easy steps
        </p>
      </div>

      {/* Progress */}
      <Card className="mb-8">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Your Progress</CardTitle>
            <div className="flex items-center gap-2">
              <Badge variant={isComplete ? 'default' : 'secondary'}>
                {completedSteps.size} / {steps.length} completed
              </Badge>
              {completedSteps.size > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleReset}
                  className="text-xs"
                >
                  Reset
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Progress</span>
              <span className="font-medium">{progress}%</span>
            </div>
            <div className="h-2 bg-secondary rounded-full overflow-hidden">
              <div
                className="h-full bg-primary transition-all duration-500"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
          {isComplete && (
            <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-lg">
              <div className="flex items-center gap-2 text-green-700 font-medium">
                <Check className="h-5 w-5" />
                Congratulations! You've completed the onboarding
              </div>
              <p className="text-sm text-green-600 mt-2">
                You're all set to build amazing applications with TurtleTrading API
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Steps */}
      <div className="space-y-4">
        {steps.map((step, index) => {
          const Icon = step.icon
          const isCompleted = completedSteps.has(step.id)

          return (
            <Card
              key={step.id}
              className={`transition-all ${isCompleted ? 'bg-green-50/50 border-green-200' : ''}`}
            >
              <CardHeader>
                <div className="flex items-start gap-4">
                  <div
                    className={`flex-shrink-0 w-12 h-12 rounded-lg flex items-center justify-center ${
                      isCompleted
                        ? 'bg-green-100 text-green-600'
                        : 'bg-primary/10 text-primary'
                    }`}
                  >
                    {isCompleted ? <Check className="h-6 w-6" /> : <Icon className="h-6 w-6" />}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle className="text-lg mb-1">
                          Step {index + 1}: {step.title}
                        </CardTitle>
                        <CardDescription>{step.description}</CardDescription>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => toggleStep(step.id)}
                        className="ml-4"
                      >
                        {isCompleted ? 'Undo' : 'Mark Complete'}
                      </Button>
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <Link href={step.href}>
                  <Button variant={isCompleted ? 'outline' : 'default'}>
                    {step.action}
                  </Button>
                </Link>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Quick Links */}
      <Card className="mt-8">
        <CardHeader>
          <CardTitle>Quick Links</CardTitle>
          <CardDescription>Additional resources to help you succeed</CardDescription>
        </CardHeader>
        <CardContent className="grid md:grid-cols-3 gap-4">
          <Link href="/developer/analytics">
            <Button variant="outline" className="w-full justify-start">
              📊 Analytics Dashboard
            </Button>
          </Link>
          <Link href="/docs">
            <Button variant="outline" className="w-full justify-start">
              📚 API Documentation
            </Button>
          </Link>
          <Link href="/developer/support">
            <Button variant="outline" className="w-full justify-start">
              💬 Get Support
            </Button>
          </Link>
        </CardContent>
      </Card>
    </div>
  )
}
