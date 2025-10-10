"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { PromptInputTextarea } from "@/components/ui/prompt-input"
import { Send, Sparkles, Copy, Check, TrendingUp, Calendar, Zap } from "lucide-react"
import { useState, useRef, useEffect, useMemo } from "react"
import { useAuth } from "@/contexts/auth-context"

const STORAGE_KEY_PREFIX = "nexpass_ai_chat_v1"

type ChatMessage = { 
  id: string
  type: "ai" | "user"
  content: string
  timestamp?: number
  suggestions?: string[]
}

function getStorageKey(userId?: string | null): string {
  const uid = typeof userId === "string" && userId.length > 0 ? userId : "anon"
  return `${STORAGE_KEY_PREFIX}:${uid}`
}

const createGreeting = () => ({
  id: typeof crypto !== 'undefined' && (crypto as any).randomUUID ? (crypto as any).randomUUID() : `${Date.now()}-init`,
  type: "ai" as const,
  content: "Hi! I can help analyze your spending and forecast your finances.",
  timestamp: Date.now(),
  suggestions: [
    "How much did I spend last month?",
    "What's my biggest expense category?",
    "Will I exceed my budget this month?",
    "Show me unusual spending",
  ]
})

// Simple fallback suggestions if AI generation fails completely
function generateFallbackSuggestions(): string[] {
  return ["Tell me more", "What else?"];
}

// Rich text formatter for currency, percentages, etc.
function formatRichText(text: string): React.ReactNode {
  // This will be rendered as JSX, highlighting numbers
  const parts = text.split(/(\€\d+(?:,\d{3})*(?:\.\d{2})?|\d+(?:\.\d+)?%|\d{1,2}\/\d{1,2}\/\d{4})/g);
  
  return parts.map((part, i) => {
    // Currency
    if (part.match(/€\d+/)) {
      return <span key={i} className="font-semibold text-[#40221a] dark:text-gray-200">{part}</span>;
    }
    // Percentage
    if (part.match(/\d+(?:\.\d+)?%/)) {
      const isNegative = text.substring(Math.max(0, text.indexOf(part) - 5), text.indexOf(part)).includes('-');
      return <span key={i} className={`font-semibold ${isNegative ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>{part}</span>;
    }
    return part;
  });
}

export function AiChatCard() {
  const { user, loading } = useAuth()
  const [message, setMessage] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [statusMessage, setStatusMessage] = useState<string>("")
  const messagesEndRef = useRef<HTMLDivElement | null>(null)
  const hasHydratedRef = useRef(false)
  const lastUserIdRef = useRef<string | undefined>(undefined)

  const generateId = () =>
    (typeof crypto !== 'undefined' && (crypto as any).randomUUID)
      ? (crypto as any).randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const storageKey = useMemo(() => getStorageKey(user?.$id), [user?.$id])

  useEffect(() => {
    if (loading) return
    const currentUserId = user?.$id

    if (hasHydratedRef.current && lastUserIdRef.current === currentUserId) return

    try {
      const key = storageKey
      const raw = typeof window !== 'undefined' ? window.localStorage.getItem(key) : null

      if (raw) {
        const parsed = JSON.parse(raw) as { input?: string; messages?: ChatMessage[] }
        if (Array.isArray(parsed?.messages) && parsed.messages.length > 0) {
          setMessages(parsed.messages)
        } else {
          setMessages([createGreeting()])
        }
        if (typeof parsed?.input === 'string') setMessage(parsed.input)
      } else if (currentUserId && typeof window !== 'undefined') {
        const anonRaw = window.localStorage.getItem(getStorageKey(undefined))
        if (anonRaw) {
          const parsed = JSON.parse(anonRaw) as { input?: string; messages?: ChatMessage[] }
          const migratedMessages = Array.isArray(parsed?.messages) && parsed.messages.length > 0 ? parsed.messages : [createGreeting()]
          setMessages(migratedMessages)
          setMessage(typeof parsed?.input === 'string' ? parsed.input : "")
          window.localStorage.setItem(key, JSON.stringify({ input: parsed?.input ?? "", messages: migratedMessages }))
        } else {
          setMessages([createGreeting()])
        }
      } else {
        setMessages([createGreeting()])
      }
    } catch {
      setMessages([createGreeting()])
    }

    hasHydratedRef.current = true
    lastUserIdRef.current = currentUserId
  }, [loading, storageKey, user?.$id])

  // Persist chat state on change (throttled lightly via setTimeout microtask merging)
  useEffect(() => {
    if (!hasHydratedRef.current) return
    try {
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(storageKey, JSON.stringify({ input: message, messages }))
      }
    } catch {}
  }, [storageKey, message, messages])

  const handleClear = () => {
    if (isLoading) return
    const greeting = createGreeting()
    setMessages([greeting])
    setMessage("")
    try {
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(storageKey, JSON.stringify({ input: "", messages: [greeting] }))
      }
    } catch {}
  }

  const handleCopy = async (content: string, id: string) => {
    try {
      await navigator.clipboard.writeText(content)
      setCopiedId(id)
      setTimeout(() => setCopiedId(null), 2000)
    } catch (err) {
      console.error('Failed to copy:', err)
    }
  }

  const handleSuggestionClick = (suggestion: string) => {
    setMessage(suggestion)
    // Auto-submit after a brief delay for better UX
    setTimeout(() => {
      const submitBtn = document.querySelector('[data-submit-btn]') as HTMLButtonElement
      submitBtn?.click()
    }, 100)
  }

  const handleSubmit = async () => {
    if (!message.trim() || isLoading) return
    
    const text = message
    const userMessage: ChatMessage = {
      id: generateId(),
      type: "user",
      content: text,
      timestamp: Date.now()
    }
    
    setMessages(prev => [...prev, userMessage])
    setMessage("")
    setIsLoading(true)
    setStatusMessage("Analyzing your request...")

    try {
      // Use the same auth pattern as other API calls and stream SSE
      const { getAuthHeader } = await import('@/lib/api')
      const authHeader = await getAuthHeader()

      const aiId = generateId()
      setMessages(prev => [...prev, { id: aiId, type: 'ai', content: '', timestamp: Date.now() }])
      setStatusMessage("Getting your financial data...")

      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'text/event-stream',
          ...authHeader
        },
        credentials: 'include',
        body: JSON.stringify({ message: text })
      })

      if (!res.ok) {
        const fallback = await res.text().catch(() => '')
        throw new Error(fallback || `API Error: ${res.status} ${res.statusText}`)
      }

      const reader = res.body?.getReader()
      const decoder = new TextDecoder()
      let aiText = ''
      let aiSuggestions: string[] = []
      if (!reader) throw new Error('No response body')
      
      setStatusMessage("Generating insights...")
      
      while (true) {
        const { value, done } = await reader.read()
        if (done) break
        const chunk = decoder.decode(value, { stream: true })
        const lines = chunk.split('\n')
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          const payload = line.slice(6)
          const trimmed = payload.trim()
          if (!payload) continue
          if (trimmed === '[DONE]') {
            // Use AI-generated suggestions, or minimal fallback if AI fails
            const suggestions = aiSuggestions.length > 0 
              ? aiSuggestions 
              : generateFallbackSuggestions()
            setMessages(prev => prev.map(m => m.id === aiId ? { ...m, content: aiText, suggestions } : m))
            break
          } else if (trimmed.startsWith('SUGGESTIONS:')) {
            // Parse AI-generated suggestions
            try {
              const jsonStr = trimmed.slice(12) // Remove "SUGGESTIONS:" prefix
              const parsed = JSON.parse(jsonStr)
              if (Array.isArray(parsed) && parsed.length > 0) {
                aiSuggestions = parsed.slice(0, 2) // Max 2 suggestions
              }
            } catch (parseErr) {
              console.error('Failed to parse suggestions:', parseErr)
            }
          } else if (trimmed.startsWith('ERROR:')) {
            aiText = 'There was an error contacting the AI service. Please try again.'
            setMessages(prev => prev.map(m => m.id === aiId ? { ...m, content: aiText } : m))
            break
          } else {
            aiText += payload
            setMessages(prev => prev.map(m => m.id === aiId ? { ...m, content: aiText } : m))
          }
        }
      }
    } catch (e) {
      const aiResponse: ChatMessage = {
        id: generateId(),
        type: "ai" as const,
        content: "There was an error contacting the AI service. Please try again.",
        timestamp: Date.now()
      }
      setMessages(prev => [...prev, aiResponse])
    } finally {
      setIsLoading(false)
      setStatusMessage("")
    }
  }

  return (
    <Card className="h-full min-h-[400px] max-h-[600px] flex flex-col overflow-hidden">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4 flex-shrink-0">
        <CardTitle className="text-base font-medium">Assistant</CardTitle>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleClear} disabled={isLoading} title="Clear conversation">
          <Sparkles className="h-4 w-4 text-muted-foreground" />
        </Button>
      </CardHeader>
      
      <CardContent className="flex flex-col p-0 flex-1 min-h-0 overflow-hidden">
        {/* Messages Container - Scrollable */}
        <div className="flex-1 min-h-0 overflow-y-auto px-4 pt-4 pb-2 space-y-3">
          {messages.map((msg, index) => (
            <div key={msg.id}>
              <div
                className={`group flex items-start gap-2.5 transition-all hover:px-2 rounded-md py-1.5 hover:bg-muted/40 ${
                  msg.type === "user" ? "flex-row-reverse" : "flex-row"
                }`}
                style={{
                  animation: `fadeIn 0.3s ease-out ${index * 0.05}s backwards`,
                }}
              >
                {/* Avatar Dot */}
                <div className={`mt-1.5 w-1.5 h-1.5 rounded-full flex-shrink-0 ring-2 ring-background transition-transform group-hover:scale-125 ${
                  msg.type === "user" 
                    ? "bg-[#40221a] dark:bg-gray-300" 
                    : "bg-muted-foreground"
                }`} />

                {/* Message Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start gap-2">
                    <div className={`inline-block max-w-[85%] rounded-md px-3 py-2 ${
                      msg.type === "user" ? "bg-[#40221a]/10" : "bg-muted/40"
                    }`}>
                      {msg.type === 'ai' && !msg.content ? (
                        <div className="flex flex-col gap-2">
                          <div className="flex items-center gap-1 py-0.5">
                            <div className="w-1.5 h-1.5 bg-muted-foreground/80 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                            <div className="w-1.5 h-1.5 bg-muted-foreground/80 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                            <div className="w-1.5 h-1.5 bg-muted-foreground/80 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                          </div>
                          {statusMessage && (
                            <p className="text-xs text-muted-foreground italic animate-pulse">{statusMessage}</p>
                          )}
                        </div>
                      ) : (
                        <p className="text-sm leading-tight text-foreground/90 group-hover:text-foreground transition-colors whitespace-pre-wrap break-words">
                          {formatRichText(msg.content)}
                        </p>
                      )}
                    </div>
                    
                    {/* Quick actions for AI messages */}
                    {msg.type === 'ai' && msg.content && (
                      <div className="opacity-0 group-hover:opacity-100 transition-opacity flex gap-1 mt-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={() => handleCopy(msg.content, msg.id)}
                          title="Copy"
                        >
                          {copiedId === msg.id ? (
                            <Check className="h-3 w-3 text-green-600" />
                          ) : (
                            <Copy className="h-3 w-3" />
                          )}
                        </Button>
                      </div>
                    )}
                  </div>
                  
                  {/* Timestamp on hover */}
                  {msg.timestamp && (
                    <div className="opacity-0 group-hover:opacity-100 transition-opacity mt-1 px-1">
                      <span className="text-[10px] text-muted-foreground">
                        {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  )}
                  
                  {/* Smart suggestions below AI responses */}
                  {msg.type === 'ai' && msg.suggestions && msg.suggestions.length > 0 && index === messages.length - 1 && !isLoading && (
                    <div className="mt-3 flex flex-wrap gap-2 animate-in fade-in duration-500">
                      {msg.suggestions.map((suggestion, idx) => (
                        <button
                          key={idx}
                          onClick={() => handleSuggestionClick(suggestion)}
                          className="text-xs px-3 py-1.5 rounded-full bg-muted/40 hover:bg-muted/70 text-foreground/70 hover:text-foreground transition-all border border-muted-foreground/10 hover:border-muted-foreground/20 flex items-center gap-1.5"
                        >
                          <Zap className="h-3 w-3" />
                          {suggestion}
                        </button>
                      ))}
                    </div>
                  )}
                  
                  {/* Show initial example questions below the first AI message */}
                  
                </div>
              </div>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>
        
        {/* Input Area - Fixed at Bottom */}
        <div className="px-4 pb-4 pt-3 bg-card border-t border-muted/20 flex-shrink-0">
          <div className="relative">
            <PromptInputTextarea 
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Ask about finances..."
              className="resize-none border border-muted-foreground/20 rounded-md px-3 py-2 text-sm focus:border-[#40221a] dark:focus:border-gray-300 transition-colors pr-10 w-full min-h-[40px] max-h-32"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  handleSubmit()
                }
              }}
            />
            <div className="absolute right-2 top-1/2 -translate-y-1/2">
              <Button
                size="sm"
                onClick={handleSubmit}
                disabled={!message.trim() || isLoading}
                data-submit-btn
                className="w-6 h-6 p-0 bg-[#40221a] dark:bg-gray-300 hover:bg-[#5d2f24] dark:hover:bg-gray-200 rounded-sm disabled:opacity-50 text-white dark:text-black transition-transform hover:scale-110"
              >
                {isLoading ? (
                  <div className="w-3 h-3 border-2 border-white dark:border-black border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Send className="h-3 w-3" />
                )}
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
      
      <style jsx>{`
        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateY(-4px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </Card>
  )
}