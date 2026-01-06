import { NextRequest, NextResponse } from 'next/server'
import { Client, Databases, ID, Query } from 'appwrite'
import { requireAuthUser } from '@/lib/auth'
import { logger } from '@/lib/logger'
import { APPWRITE_CONFIG, COLLECTIONS } from '@/lib/config'
import { handleApiError } from '@/lib/api-error-handler'
import type { AuthUser } from '@/lib/types'

// Simple in-memory cache for user goals within a single server process lifecycle
type GoalsPayload = {
  $id?: string
  userId: string
  balanceGoal: number
  savingsRateGoal: number
  baseCurrency: string
}

const goalsCache = new Map<string, GoalsPayload>()

const client = new Client()
  .setEndpoint(APPWRITE_CONFIG.endpoint)
  .setProject(APPWRITE_CONFIG.projectId)

const databases = new Databases(client)

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuthUser(request) as AuthUser
    const userId: string = user.$id || user.id || ''

    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 })
    }

    // Serve from cache when available (avoid database read)
    const cached = goalsCache.get(userId)
    if (cached) {
      return NextResponse.json(cached, { headers: { 'X-Cache': 'HIT' } })
    }

    try {
      const apiKey = APPWRITE_CONFIG.apiKey
      if (apiKey) {
        (client as { headers: Record<string, string> }).headers = { 
          ...(client as { headers: Record<string, string> }).headers, 
          'X-Appwrite-Key': apiKey 
        }
      } else {
        const auth = request.headers.get('authorization') || request.headers.get('Authorization')
        const token = auth?.startsWith('Bearer ') ? auth.slice(7) : undefined
        if (token) {
          (client as { headers: Record<string, string> }).headers = { 
            ...(client as { headers: Record<string, string> }).headers, 
            'X-Appwrite-JWT': token 
          }
        }
      }

      const response = await databases.listDocuments(
        APPWRITE_CONFIG.databaseId,
        COLLECTIONS.goals,
        [Query.equal('userId', userId)]
      )

      if (response.documents.length > 0) {
        const doc = response.documents[0] as { $id: string; userId: string; balanceGoal?: number; savingsRateGoal?: number; baseCurrency?: string }
        const payload: GoalsPayload = {
          $id: doc.$id,
          userId: doc.userId,
          balanceGoal: Number(doc.balanceGoal || 0),
          savingsRateGoal: Number(doc.savingsRateGoal || 20),
          baseCurrency: doc.baseCurrency || 'EUR',
        }
        goalsCache.set(userId, payload)
        return NextResponse.json(payload, { headers: { 'X-Cache': 'MISS' } })
      }

      const fallback: GoalsPayload = {
        userId,
        balanceGoal: 0,
        savingsRateGoal: 20,
        baseCurrency: 'EUR',
      }
      goalsCache.set(userId, fallback)
      return NextResponse.json(fallback, { headers: { 'X-Cache': 'MISS' } })
    } catch (error: unknown) {
      return handleApiError(error, 500)
    }
  } catch (error: unknown) {
    return handleApiError(error, 401)
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { balanceGoal, savingsRateGoal } = body as { balanceGoal?: number; savingsRateGoal?: number }

    if (balanceGoal !== undefined && (typeof balanceGoal !== 'number' || balanceGoal < 0)) {
      return NextResponse.json({ error: 'balanceGoal must be a non-negative number' }, { status: 400 })
    }
    if (savingsRateGoal !== undefined && (typeof savingsRateGoal !== 'number' || savingsRateGoal < 0)) {
      return NextResponse.json({ error: 'savingsRateGoal must be a non-negative number' }, { status: 400 })
    }

    const user = await requireAuthUser(request) as AuthUser
    const userId: string = user.$id || user.id || ''

    try {
      const apiKey = APPWRITE_CONFIG.apiKey
      if (apiKey) {
        (client as { headers: Record<string, string> }).headers = { 
          ...(client as { headers: Record<string, string> }).headers, 
          'X-Appwrite-Key': apiKey 
        }
      } else {
        const auth = request.headers.get('authorization') || request.headers.get('Authorization')
        const token = auth?.startsWith('Bearer ') ? auth.slice(7) : undefined
        if (token) {
          (client as { headers: Record<string, string> }).headers = { 
            ...(client as { headers: Record<string, string> }).headers, 
            'X-Appwrite-JWT': token 
          }
        }
      }

      const existing = await databases.listDocuments(
        APPWRITE_CONFIG.databaseId,
        COLLECTIONS.goals,
        [Query.equal('userId', userId)]
      )

      const updateData: Record<string, unknown> = {}
      if (balanceGoal !== undefined) updateData.balanceGoal = balanceGoal
      if (savingsRateGoal !== undefined) updateData.savingsRateGoal = savingsRateGoal

      if (existing.documents.length > 0) {
        const doc = existing.documents[0]
        await databases.updateDocument(APPWRITE_CONFIG.databaseId, COLLECTIONS.goals, doc.$id, updateData)
        // Update cache with new values when present
        const current = goalsCache.get(userId)
        goalsCache.set(userId, {
          $id: doc.$id,
          userId,
          balanceGoal: (updateData.balanceGoal as number | undefined) ?? current?.balanceGoal ?? Number(doc.balanceGoal || 0),
          savingsRateGoal: (updateData.savingsRateGoal as number | undefined) ?? current?.savingsRateGoal ?? Number(doc.savingsRateGoal || 20),
          baseCurrency: current?.baseCurrency ?? doc.baseCurrency ?? 'EUR',
        })
      } else {
        await databases.createDocument(
          APPWRITE_CONFIG.databaseId,
          COLLECTIONS.goals,
          ID.unique(),
          {
            userId,
            baseCurrency: 'EUR',
            balanceGoal: balanceGoal ?? 0,
            savingsRateGoal: savingsRateGoal ?? 20,
          }
        )
        goalsCache.set(userId, {
          userId,
          baseCurrency: 'EUR',
          balanceGoal: balanceGoal ?? 0,
          savingsRateGoal: savingsRateGoal ?? 20,
        })
      }

      return NextResponse.json({ success: true })
    } catch (error: unknown) {
      return handleApiError(error, 500)
    }
  } catch (error: unknown) {
    return handleApiError(error, 500)
  }
}


