import { PDFDocument, degrees } from 'pdf-lib'
import { NextRequest } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()

    const pdfFile = formData.get('pdf') as File | null
    const logoFile = formData.get('logo') as File | null
    const size = Number(formData.get('size') ?? 80)
    const opacity = Number(formData.get('opacity') ?? 30)
    const rotation = Number(formData.get('rotation') ?? 20)

    if (!pdfFile || !logoFile) {
      return Response.json({ error: 'Both a PDF and a logo file are required.' }, { status: 400 })
    }

    const [pdfBuffer, logoBuffer] = await Promise.all([
      pdfFile.arrayBuffer(),
      logoFile.arrayBuffer(),
    ])

    const pdfDoc = await PDFDocument.load(pdfBuffer)

    const logoName = logoFile.name.toLowerCase()
    const isJpeg = logoName.endsWith('.jpg') || logoName.endsWith('.jpeg')
    const logoImage = isJpeg
      ? await pdfDoc.embedJpg(new Uint8Array(logoBuffer))
      : await pdfDoc.embedPng(new Uint8Array(logoBuffer))

    const { width: imgW, height: imgH } = logoImage.scale(1)

    for (const page of pdfDoc.getPages()) {
      const { width, height } = page.getSize()
      const logoWidth = width * (size / 100)
      const logoHeight = logoWidth * (imgH / imgW)

      const cx = width / 2
      const cy = height / 2

      // Rotate around the image center. pdf-lib rotates around the bottom-left
      // corner, so we adjust the origin so the center lands on the page center.
      // Negate rotation to match CSS clockwise convention used in the preview.
      const rad = ((-rotation) * Math.PI) / 180
      const originX = cx - (logoWidth / 2) * Math.cos(rad) + (logoHeight / 2) * Math.sin(rad)
      const originY = cy - (logoWidth / 2) * Math.sin(rad) - (logoHeight / 2) * Math.cos(rad)

      page.drawImage(logoImage, {
        x: originX,
        y: originY,
        width: logoWidth,
        height: logoHeight,
        opacity: opacity / 100,
        rotate: degrees(-rotation),
      })
    }

    const processedBytes = await pdfDoc.save()

    return new Response(Buffer.from(processedBytes), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': 'attachment; filename="watermarked.pdf"',
      },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[process]', message)
    return Response.json({ error: message }, { status: 500 })
  }
}
