"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import {
  PromptInput,
  PromptInputTextarea,
  PromptInputActions,
  PromptInputAction,
} from "@/components/ui/prompt-input"
import { Send, Sparkles } from "lucide-react"
import { useState } from "react"

export function AiChatCard() {
  const [message, setMessage] = useState("")
  const [isLoading, setIsLoading] = useState(false)

  const handleSubmit = async () => {
    if (!message.trim() || isLoading) return
    
    setIsLoading(true)
    // Simulate AI response delay
    setTimeout(() => {
      setIsLoading(false)
      setMessage("")
    }, 2000)
  }

  return (
    <Card className="h-full">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <Sparkles className="h-5 w-5" />
          AI Financial Assistant
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col h-full p-6">
        <div className="flex-1 mb-4">
          <div className="bg-muted/50 rounded-lg p-4 mb-4">
            <p className="text-sm text-muted-foreground">
              Hi! I'm your AI financial assistant. What would you like to know?
            </p>
          </div>
          
          {isLoading && (
            <div className="bg-blue-50 dark:bg-blue-950/20 rounded-lg p-4 mb-4">
              <div className="flex items-center gap-2">
                <div className="animate-spin h-4 w-4 border-2 border-blue-500 border-t-transparent rounded-full"></div>
                <p className="text-sm text-blue-700 dark:text-blue-300">
                  AI is thinking...
                </p>
              </div>
            </div>
          )}
        </div>
        
        <div className="mt-auto">
          <PromptInput
            value={message}
            onValueChange={setMessage}
            onSubmit={handleSubmit}
            isLoading={isLoading}
            className="w-full"
          >
            <PromptInputTextarea 
              placeholder="Ask me about your finances..."
              className="resize-none"
            />
            <PromptInputActions>
              <PromptInputAction tooltip="Send message">
                <Button
                  size="sm"
                  onClick={handleSubmit}
                  disabled={!message.trim() || isLoading}
                  className="rounded-full"
                >
                  <Send className="h-4 w-4" />
                </Button>
              </PromptInputAction>
            </PromptInputActions>
          </PromptInput>
        </div>
      </CardContent>
    </Card>
  )
}
