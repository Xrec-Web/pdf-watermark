import { put } from '@vercel/blob'
import { NextRequest } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    if (!process.env.BLOB_READ_WRITE_TOKEN) {
      return Response.json(
        { error: 'BLOB_READ_WRITE_TOKEN is not configured. Add it to your environment variables.' },
        { status: 500 }
      )
    }

    const formData = await request.formData()
    const file = formData.get('file') as File
    const type = formData.get('type') as string

    if (!file) {
      return Response.json({ error: 'No file provided' }, { status: 400 })
    }

    const blob = await put(`${type}/${Date.now()}-${file.name}`, file, {
      access: 'public',
    })

    return Response.json({ url: blob.url })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[upload]', message)
    return Response.json({ error: message }, { status: 500 })
  }
}
