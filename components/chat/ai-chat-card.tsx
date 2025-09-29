"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { PromptInputTextarea } from "@/components/ui/prompt-input"
import { Send, Sparkles, Bot, User } from "lucide-react"
import { useState, useRef, useEffect } from "react"
import { useAuth } from "@/contexts/auth-context"

const STORAGE_KEY_PREFIX = "nexpass_ai_chat_v1"

type ChatMessage = { id: string; type: "ai" | "user"; content: string }

function getStorageKey(userId?: string | null): string {
  const uid = typeof userId === "string" && userId.length > 0 ? userId : "anon"
  return `${STORAGE_KEY_PREFIX}:${uid}`
}

export function AiChatCard() {
  const { user } = useAuth()
  const [message, setMessage] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const messagesEndRef = useRef<HTMLDivElement | null>(null)

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

  // Load persisted chat on mount or when user changes
  useEffect(() => {
    try {
      const key = getStorageKey(user?.$id)
      const raw = typeof window !== 'undefined' ? window.localStorage.getItem(key) : null
      if (raw) {
        const parsed = JSON.parse(raw) as { input?: string; messages?: ChatMessage[] }
        if (Array.isArray(parsed?.messages) && parsed.messages.length > 0) {
          setMessages(parsed.messages)
        } else {
          // seed with intro message
          setMessages([
            {
              id: typeof crypto !== 'undefined' && (crypto as any).randomUUID ? (crypto as any).randomUUID() : `${Date.now()}-init`,
              type: "ai",
              content: "Hi! I can help with budgeting, investments, and financial planning. "
            }
          ])
        }
        if (typeof parsed?.input === 'string') setMessage(parsed.input)
      } else {
        setMessages([
          {
            id: typeof crypto !== 'undefined' && (crypto as any).randomUUID ? (crypto as any).randomUUID() : `${Date.now()}-init`,
            type: "ai",
            content: "Hi! I can help with budgeting, investments, and financial planning. "
          }
        ])
      }
    } catch {
      // ignore
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.$id])

  // Persist chat state on change (throttled lightly via setTimeout microtask merging)
  useEffect(() => {
    const key = getStorageKey(user?.$id)
    try {
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(key, JSON.stringify({ input: message, messages }))
      }
    } catch {}
  }, [user?.$id, message, messages])

  const handleSubmit = async () => {
    if (!message.trim() || isLoading) return
    
    const text = message
    const userMessage: ChatMessage = {
      id: generateId(),
      type: "user",
      content: text
    }
    
    setMessages(prev => [...prev, userMessage])
    setMessage("")
    setIsLoading(true)

    try {
      // Use the same auth pattern as other API calls and stream SSE
      const { getAuthHeader } = await import('@/lib/api')
      const authHeader = await getAuthHeader()

      const aiId = generateId()
      setMessages(prev => [...prev, { id: aiId, type: 'ai', content: '' }])

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
      if (!reader) throw new Error('No response body')
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
            break
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
        content: "There was an error contacting the AI service. Please try again."
      }
      setMessages(prev => [...prev, aiResponse])
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Card className="h-[380px] sm:h-[420px] md:h-[460px] lg:h-[520px] flex flex-col overflow-hidden">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4 flex-shrink-0">
        <CardTitle className="text-base font-medium">AI Assistant</CardTitle>
        <Sparkles className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      
      <CardContent className="flex flex-col p-0 flex-1 min-h-0 overflow-hidden">
        {/* Messages Container - Scrollable */}
        <div className="flex-1 min-h-0 overflow-y-auto px-4 pt-4 pb-2 space-y-3">
          {messages.map((msg, index) => (
            <div
              key={msg.id}
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
                <div className={`inline-block max-w-[85%] rounded-md px-3 py-2 ${
                  msg.type === "user" ? "bg-[#40221a]/10" : "bg-muted/40"
                }`}>
                  {msg.type === 'ai' && !msg.content ? (
                    <div className="flex items-center gap-1 py-0.5">
                      <div className="w-1.5 h-1.5 bg-muted-foreground/80 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                      <div className="w-1.5 h-1.5 bg-muted-foreground/80 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                      <div className="w-1.5 h-1.5 bg-muted-foreground/80 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                    </div>
                  ) : (
                    <p className="text-sm leading-tight text-foreground/90 group-hover:text-foreground transition-colors whitespace-pre-wrap break-words">
                      {msg.content}
                    </p>
                  )}
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
                className="w-6 h-6 p-0 bg-[#40221a] dark:bg-gray-300 hover:bg-[#5d2f24] dark:hover:bg-gray-200 rounded-sm disabled:opacity-50 text-white dark:text-black"
              >
                <Send className="h-3 w-3" />
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