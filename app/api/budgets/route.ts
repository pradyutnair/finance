import { NextRequest, NextResponse } from 'next/server'
import { Client, Databases, ID, Query } from 'appwrite'
import { requireAuthUser } from '@/lib/auth'

// In-memory cache of budget preferences for the current server process
type BudgetPayload = {
  $id?: string
  userId: string
  baseCurrency: string
  groceriesBudget: number
  restaurantsBudget: number
  transportBudget: number
  travelBudget: number
  shoppingBudget: number
  utilitiesBudget: number
  entertainmentBudget: number
  healthBudget: number
  miscellaneousBudget: number
}

const budgetsCache = new Map<string, BudgetPayload>()

const client = new Client()
  .setEndpoint(process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT || 'https://cloud.appwrite.io/v1')
  .setProject(process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID || '')

const databases = new Databases(client)
const databaseId = process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID || '68d42ac20031b27284c9'
const COLLECTION_ID = process.env.APPWRITE_PREFERENCES_BUDGETS_COLLECTION_ID || 'preferences_budgets_dev'

// GET - Fetch user's budget preferences
export async function GET(request: NextRequest) {
  try {
    // Authenticate user and derive userId
    const user: any = await requireAuthUser(request)
    const userId: string = user.$id || user.id

    if (!userId) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      )
    }

    // Return from cache if present
    const cached = budgetsCache.get(userId)
    if (cached) {
      return NextResponse.json(cached, { headers: { 'X-Cache': 'HIT' } })
    }

    try {
      // Set auth: prefer server API key, fallback to JWT if provided
      const apiKey = process.env.APPWRITE_API_KEY as string | undefined
      if (apiKey) {
        ;(client as any).headers = { ...(client as any).headers, 'X-Appwrite-Key': apiKey }
      } else {
        const auth = request.headers.get('authorization') || request.headers.get('Authorization')
        const token = auth?.startsWith('Bearer ') ? auth.slice(7) : undefined
        if (token) (client as any).headers = { ...(client as any).headers, 'X-Appwrite-JWT': token }
      }

      const response = await databases.listDocuments(
        databaseId,
        COLLECTION_ID,
        [Query.equal('userId', userId)]
      )

      if (response.documents.length > 0) {
        const budget = response.documents[0]
        const payload: BudgetPayload = {
          $id: budget.$id,
          userId: budget.userId,
          baseCurrency: budget.baseCurrency || 'EUR',
          groceriesBudget: budget.groceriesBudget || 0,
          restaurantsBudget: budget.restaurantsBudget || 0,
          transportBudget: budget.transportBudget || 0,
          travelBudget: budget.travelBudget || 0,
          shoppingBudget: budget.shoppingBudget || 0,
          utilitiesBudget: budget.utilitiesBudget || 0,
          entertainmentBudget: budget.entertainmentBudget || 0,
          healthBudget: budget.healthBudget || 0,
          miscellaneousBudget: budget.miscellaneousBudget || 0,
        }
        budgetsCache.set(userId, payload)
        return NextResponse.json(payload, { headers: { 'X-Cache': 'MISS' } })
      } else {
        // Return default budget structure if no budget exists
        const fallback: BudgetPayload = {
          userId,
          baseCurrency: 'EUR',
          groceriesBudget: 0,
          restaurantsBudget: 0,
          transportBudget: 0,
          travelBudget: 0,
          shoppingBudget: 0,
          utilitiesBudget: 0,
          entertainmentBudget: 0,
          healthBudget: 0,
          miscellaneousBudget: 0,
        }
        budgetsCache.set(userId, fallback)
        return NextResponse.json(fallback, { headers: { 'X-Cache': 'MISS' } })
      }
    } catch (error) {
      console.error('Error fetching budgets:', error)
      return NextResponse.json(
        { error: 'Failed to fetch budget data' },
        { status: 500 }
      )
    }
  } catch (error) {
    console.error('Error in GET /api/budgets:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// POST - Create or update user's budget preferences
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      baseCurrency,
      groceriesBudget,
      restaurantsBudget,
      transportBudget,
      travelBudget,
      shoppingBudget,
      utilitiesBudget,
      entertainmentBudget,
      healthBudget,
      miscellaneousBudget,
    } = body

    // Authenticate user and derive userId
    const user: any = await requireAuthUser(request)
    const userId: string = user.$id || user.id

    // Validate budget values
    const budgetFields = {
      groceriesBudget,
      restaurantsBudget,
      transportBudget,
      travelBudget,
      shoppingBudget,
      utilitiesBudget,
      entertainmentBudget,
      healthBudget,
      miscellaneousBudget,
    }

    for (const [key, value] of Object.entries(budgetFields)) {
      if (value !== undefined && (typeof value !== 'number' || value < 0)) {
        return NextResponse.json(
          { error: `${key} must be a non-negative number` },
          { status: 400 }
        )
      }
    }

    if (!baseCurrency || typeof baseCurrency !== 'string') {
      return NextResponse.json(
        { error: 'Base currency is required and must be a string' },
        { status: 400 }
      )
    }

    try {
      // Set auth: prefer server API key, fallback to JWT if provided
      const apiKey = process.env.APPWRITE_API_KEY as string | undefined
      if (apiKey) {
        ;(client as any).headers = { ...(client as any).headers, 'X-Appwrite-Key': apiKey }
      } else {
        const auth = request.headers.get('authorization') || request.headers.get('Authorization')
        const token = auth?.startsWith('Bearer ') ? auth.slice(7) : undefined
        if (token) (client as any).headers = { ...(client as any).headers, 'X-Appwrite-JWT': token }
      }

      // First, try to find existing budget document
      const existingBudgets = await databases.listDocuments(
        databaseId,
        COLLECTION_ID,
        [Query.equal('userId', userId)]
      )

      const budgetData = {
        userId,
        baseCurrency,
        groceriesBudget: groceriesBudget || 0,
        restaurantsBudget: restaurantsBudget || 0,
        transportBudget: transportBudget || 0,
        travelBudget: travelBudget || 0,
        shoppingBudget: shoppingBudget || 0,
        utilitiesBudget: utilitiesBudget || 0,
        entertainmentBudget: entertainmentBudget || 0,
        healthBudget: healthBudget || 0,
        miscellaneousBudget: miscellaneousBudget || 0,
      }

      if (existingBudgets.documents.length > 0) {
        // Update existing budget
        const existingBudget = existingBudgets.documents[0]
        await databases.updateDocument(
          databaseId,
          COLLECTION_ID,
          existingBudget.$id,
          budgetData
        )
        // Update cache with the new data
        budgetsCache.set(userId, { $id: existingBudget.$id, ...budgetData })
      } else {
        // Create new budget document
        await databases.createDocument(
          databaseId,
          COLLECTION_ID,
          ID.unique(),
          budgetData
        )
        // Cache the newly created preferences
        budgetsCache.set(userId, { ...budgetData })
      }

      return NextResponse.json({
        success: true,
        message: 'Budget preferences saved successfully'
      })

    } catch (error) {
      console.error('Error saving budget:', error)
      return NextResponse.json(
        { error: 'Failed to save budget data' },
        { status: 500 }
      )
    }
  } catch (error) {
    console.error('Error in POST /api/budgets:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
