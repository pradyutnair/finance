"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import {
  PromptInput,
  PromptInputTextarea,
  PromptInputActions,
  PromptInputAction,
} from "@/components/ui/prompt-input"
import { Send, Sparkles, User, Bot } from "lucide-react"
import { useState, useRef, useEffect } from "react"

export function AiChatCard() {
  const [message, setMessage] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [messages, setMessages] = useState([
    {
      id: 1,
      type: "ai",
      content: "Hi! I can help with budgeting, investments, and financial planning."
    }
  ])
  const messagesEndRef = useRef(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const handleSubmit = async () => {
    if (!message.trim() || isLoading) return
    
    const userMessage = {
      id: Date.now(),
      type: "user",
      content: message
    }
    
    setMessages(prev => [...prev, userMessage])
    setMessage("")
    setIsLoading(true)
    
    // Simulate AI response delay
    setTimeout(() => {
      const aiResponse = {
        id: Date.now() + 1,
        type: "ai",
        content: "I'll help you with that. Let me provide some insights and recommendations."
      }
      setMessages(prev => [...prev, aiResponse])
      setIsLoading(false)
    }, 2000)
  }

  return (
    <Card className="h-full">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
        <CardTitle className="text-base font-medium flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-muted-foreground" />
          AI Assistant
        </CardTitle>
      </CardHeader>
      
      <CardContent className="flex flex-col p-0 relative h-full">
        {/* Messages Container */}
        <div className="flex-1 px-4 pt-4 space-y-3 overflow-y-auto" style={{ paddingBottom: '80px' }}>
          {messages.map((msg, index) => (
            <div
              key={msg.id}
              className={`group flex items-start gap-2.5 transition-all hover:px-2 rounded-md hover:bg-muted/40 py-2 ${
                msg.type === "user" ? "flex-row-reverse" : "flex-row"
              }`}
              style={{
                animation: `fadeIn 0.3s ease-out ${index * 0.05}s backwards`,
              }}
            >
              {/* Avatar */}
              <div className={`mt-0.5 w-1.5 h-1.5 rounded-full flex-shrink-0 ring-2 ring-background transition-transform group-hover:scale-125 ${
                msg.type === "user" 
                  ? "bg-[#40221a]" 
                  : "bg-muted-foreground"
              }`} />

              {/* Message Content */}
              <div className="flex-1 min-w-0">
                <p className="text-sm leading-tight text-foreground/90 group-hover:text-foreground transition-colors">
                  {msg.content}
                </p>
              </div>
            </div>
          ))}
          
          {/* Loading Animation */}
          {isLoading && (
            <div className="group flex items-start gap-2.5 transition-all hover:px-2 rounded-md hover:bg-muted/40 py-2">
              <div className="mt-0.5 w-1.5 h-1.5 rounded-full flex-shrink-0 ring-2 ring-background bg-muted-foreground transition-transform group-hover:scale-125" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <div className="flex gap-1">
                    <div className="w-1.5 h-1.5 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                    <div className="w-1.5 h-1.5 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                    <div className="w-1.5 h-1.5 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                  </div>
                  <span className="text-xs text-muted-foreground/70">Thinking...</span>
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
        
        {/* Input Area - Fixed at Bottom */}
        <div className="absolute bottom-0 left-0 right-0 px-4 pb-4 bg-card border-t border-muted/20 pt-4">
          <PromptInput
            value={message}
            onValueChange={setMessage}
            onSubmit={handleSubmit}
            isLoading={isLoading}
            className="w-full"
          >
            <div className="relative">
              <PromptInputTextarea 
                placeholder="Ask about finances..."
                className="resize-none border border-muted-foreground/20 rounded-md px-3 py-2 text-sm focus:border-[#40221a] transition-colors pr-10"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    handleSubmit()
                  }
                }}
              />
              <PromptInputActions className="absolute right-2 top-1/2 -translate-y-1/2">
                <PromptInputAction tooltip="Send">
                  <Button
                    size="sm"
                    onClick={handleSubmit}
                    disabled={!message.trim() || isLoading}
                    className="w-6 h-6 p-0 bg-[#40221a] hover:bg-[#5d2f24] rounded-sm disabled:opacity-50"
                  >
                    <Send className="h-3 w-3" />
                  </Button>
                </PromptInputAction>
              </PromptInputActions>
            </div>
          </PromptInput>
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