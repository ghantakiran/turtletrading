'use client'

import { useState, useRef } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { BookOpen, MessageSquare, Mail, Github, FileQuestion, Lightbulb, Bug, CheckCircle2, AlertCircle } from 'lucide-react'
import Link from 'next/link'
import {
  FeedbackType,
  FeedbackFormData,
  validateFeedbackForm,
  saveFeedbackSubmission,
} from '@/lib/feedback/utils'

export default function SupportPage() {
  const [feedbackType, setFeedbackType] = useState<FeedbackType>('question')
  const [feedbackSubmitted, setFeedbackSubmitted] = useState(false)
  const [formData, setFormData] = useState<FeedbackFormData>({
    type: 'question',
    subject: '',
    description: '',
    environment: '',
  })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const formRef = useRef<HTMLFormElement>(null)

  const handleSubmitFeedback = (e: React.FormEvent) => {
    e.preventDefault()

    // Validate form
    const validation = validateFeedbackForm(formData)

    if (!validation.isValid) {
      setErrors(validation.errors)
      return
    }

    // Save to localStorage
    saveFeedbackSubmission(formData)

    // Show success message
    setFeedbackSubmitted(true)
    setErrors({})

    // Reset form
    setFormData({
      type: feedbackType,
      subject: '',
      description: '',
      environment: '',
    })
    formRef.current?.reset()

    // Hide success message after 5 seconds
    setTimeout(() => setFeedbackSubmitted(false), 5000)
  }

  const handleInputChange = (field: keyof FeedbackFormData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
    // Clear error for this field when user starts typing
    if (errors[field]) {
      setErrors((prev) => {
        const newErrors = { ...prev }
        delete newErrors[field]
        return newErrors
      })
    }
  }

  const handleTypeChange = (newType: FeedbackType) => {
    setFeedbackType(newType)
    setFormData((prev) => ({ ...prev, type: newType }))
  }

  return (
    <div className="container mx-auto py-8 px-4 max-w-5xl">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Developer Support</h1>
        <p className="text-muted-foreground">
          Get help, report issues, and request new features
        </p>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Quick Help */}
        <div className="lg:col-span-2 space-y-6">
          {/* Support Resources */}
          <Card>
            <CardHeader>
              <CardTitle>Support Resources</CardTitle>
              <CardDescription>Find answers and get help</CardDescription>
            </CardHeader>
            <CardContent className="grid md:grid-cols-2 gap-4">
              <Link href="/docs">
                <Button variant="outline" className="w-full justify-start h-auto py-4">
                  <div className="flex items-start gap-3">
                    <BookOpen className="h-5 w-5 mt-1" />
                    <div className="text-left">
                      <div className="font-semibold">Documentation</div>
                      <div className="text-xs text-muted-foreground">
                        Comprehensive API guides and tutorials
                      </div>
                    </div>
                  </div>
                </Button>
              </Link>

              <a
                href="https://github.com/ghantakiran/turtletrading/discussions"
                target="_blank"
                rel="noopener noreferrer"
              >
                <Button variant="outline" className="w-full justify-start h-auto py-4">
                  <div className="flex items-start gap-3">
                    <MessageSquare className="h-5 w-5 mt-1" />
                    <div className="text-left">
                      <div className="font-semibold">Community Forum</div>
                      <div className="text-xs text-muted-foreground">
                        Ask questions and share knowledge
                      </div>
                    </div>
                  </div>
                </Button>
              </a>

              <a
                href="https://github.com/ghantakiran/turtletrading/issues"
                target="_blank"
                rel="noopener noreferrer"
              >
                <Button variant="outline" className="w-full justify-start h-auto py-4">
                  <div className="flex items-start gap-3">
                    <Github className="h-5 w-5 mt-1" />
                    <div className="text-left">
                      <div className="font-semibold">GitHub Issues</div>
                      <div className="text-xs text-muted-foreground">
                        Report bugs and track development
                      </div>
                    </div>
                  </div>
                </Button>
              </a>

              <Link href="/developer/status">
                <Button variant="outline" className="w-full justify-start h-auto py-4">
                  <div className="flex items-start gap-3">
                    <FileQuestion className="h-5 w-5 mt-1" />
                    <div className="text-left">
                      <div className="font-semibold">API Status</div>
                      <div className="text-xs text-muted-foreground">
                        Check service health and uptime
                      </div>
                    </div>
                  </div>
                </Button>
              </Link>
            </CardContent>
          </Card>

          {/* Feedback Form */}
          <Card>
            <CardHeader>
              <CardTitle>Submit Feedback</CardTitle>
              <CardDescription>Help us improve TurtleTrading API</CardDescription>
            </CardHeader>
            <CardContent>
              <Tabs value={feedbackType} onValueChange={(v) => handleTypeChange(v as FeedbackType)}>
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="question">
                    <FileQuestion className="h-4 w-4 mr-2" />
                    Question
                  </TabsTrigger>
                  <TabsTrigger value="feature">
                    <Lightbulb className="h-4 w-4 mr-2" />
                    Feature Request
                  </TabsTrigger>
                  <TabsTrigger value="bug">
                    <Bug className="h-4 w-4 mr-2" />
                    Bug Report
                  </TabsTrigger>
                </TabsList>

                <form ref={formRef} onSubmit={handleSubmitFeedback} className="mt-6 space-y-4">
                  <div>
                    <label htmlFor="subject" className="text-sm font-medium mb-2 block">
                      Subject *
                    </label>
                    <input
                      id="subject"
                      name="subject"
                      type="text"
                      value={formData.subject}
                      onChange={(e) => handleInputChange('subject', e.target.value)}
                      className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 ${
                        errors.subject
                          ? 'border-red-500 focus:ring-red-500'
                          : 'border-gray-300 focus:ring-primary'
                      }`}
                      placeholder={
                        feedbackType === 'bug'
                          ? 'Brief description of the issue'
                          : feedbackType === 'feature'
                          ? 'What feature would you like to see?'
                          : 'What do you need help with?'
                      }
                    />
                    {errors.subject && (
                      <div className="flex items-center gap-1 mt-1 text-xs text-red-600">
                        <AlertCircle className="h-3 w-3" />
                        {errors.subject}
                      </div>
                    )}
                  </div>

                  <div>
                    <label htmlFor="description" className="text-sm font-medium mb-2 block">
                      Description *
                    </label>
                    <textarea
                      id="description"
                      name="description"
                      value={formData.description}
                      onChange={(e) => handleInputChange('description', e.target.value)}
                      className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 min-h-[120px] ${
                        errors.description
                          ? 'border-red-500 focus:ring-red-500'
                          : 'border-gray-300 focus:ring-primary'
                      }`}
                      placeholder={
                        feedbackType === 'bug'
                          ? 'Steps to reproduce, expected vs actual behavior...'
                          : feedbackType === 'feature'
                          ? 'Describe the feature and how it would help you...'
                          : 'Provide details about your question...'
                      }
                    />
                    {errors.description && (
                      <div className="flex items-center gap-1 mt-1 text-xs text-red-600">
                        <AlertCircle className="h-3 w-3" />
                        {errors.description}
                      </div>
                    )}
                  </div>

                  {feedbackType === 'bug' && (
                    <div>
                      <label htmlFor="environment" className="text-sm font-medium mb-2 block">
                        Environment (Optional)
                      </label>
                      <input
                        id="environment"
                        name="environment"
                        type="text"
                        value={formData.environment}
                        onChange={(e) => handleInputChange('environment', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                        placeholder="Browser, SDK version, etc."
                      />
                    </div>
                  )}

                  <Button type="submit" className="w-full">
                    <Mail className="h-4 w-4 mr-2" />
                    Submit {feedbackType === 'bug' ? 'Bug Report' : feedbackType === 'feature' ? 'Feature Request' : 'Question'}
                  </Button>

                  {feedbackSubmitted && (
                    <div className="p-4 bg-green-50 border border-green-200 rounded-lg flex items-start gap-3">
                      <CheckCircle2 className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
                      <div>
                        <div className="font-medium text-green-900">Thank you for your feedback!</div>
                        <div className="text-sm text-green-700 mt-1">
                          Your {feedbackType === 'bug' ? 'bug report' : feedbackType === 'feature' ? 'feature request' : 'question'} has been submitted successfully.
                          We'll review it and get back to you soon.
                        </div>
                      </div>
                    </div>
                  )}
                </form>
              </Tabs>
            </CardContent>
          </Card>
        </div>

        {/* Contact & FAQ */}
        <div className="space-y-6">
          {/* Contact */}
          <Card>
            <CardHeader>
              <CardTitle>Contact Us</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <div className="text-sm font-medium mb-1">Email Support</div>
                <a
                  href="mailto:support@turtletrading.com"
                  className="text-sm text-primary hover:underline"
                >
                  support@turtletrading.com
                </a>
                <p className="text-xs text-muted-foreground mt-1">
                  Response within 24 hours
                </p>
              </div>

              <div>
                <div className="text-sm font-medium mb-1">Developer Chat</div>
                <a
                  href="https://discord.gg/turtletrading"
                  className="text-sm text-primary hover:underline"
                >
                  Join Discord Server
                </a>
                <p className="text-xs text-muted-foreground mt-1">
                  Real-time community support
                </p>
              </div>

              <div>
                <div className="text-sm font-medium mb-1">GitHub</div>
                <a
                  href="https://github.com/ghantakiran/turtletrading"
                  className="text-sm text-primary hover:underline"
                >
                  View Repository
                </a>
                <p className="text-xs text-muted-foreground mt-1">
                  Issues and discussions
                </p>
              </div>
            </CardContent>
          </Card>

          {/* FAQ */}
          <Card>
            <CardHeader>
              <CardTitle>Common Questions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <div className="text-sm font-medium mb-1">How do I get an API key?</div>
                <p className="text-xs text-muted-foreground">
                  Visit the{' '}
                  <Link href="/developer/api-keys" className="text-primary hover:underline">
                    API Keys page
                  </Link>{' '}
                  to generate your first key.
                </p>
              </div>

              <div>
                <div className="text-sm font-medium mb-1">What are rate limits?</div>
                <p className="text-xs text-muted-foreground">
                  Free tier allows 1,000 requests/month. See{' '}
                  <Link href="/docs/rate-limits" className="text-primary hover:underline">
                    rate limits docs
                  </Link>
                  .
                </p>
              </div>

              <div>
                <div className="text-sm font-medium mb-1">Where can I find examples?</div>
                <p className="text-xs text-muted-foreground">
                  Check our{' '}
                  <Link href="/docs" className="text-primary hover:underline">
                    documentation
                  </Link>{' '}
                  for code examples in multiple languages.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Response Times */}
          <Card>
            <CardHeader>
              <CardTitle>Support Hours</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Email</span>
                <Badge variant="secondary">24h response</Badge>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Discord</span>
                <Badge variant="secondary">Real-time</Badge>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">GitHub Issues</span>
                <Badge variant="secondary">48h response</Badge>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
