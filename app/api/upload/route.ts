import { put } from '@vercel/blob'
import { NextRequest } from 'next/server'

export async function POST(request: NextRequest) {
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
}
