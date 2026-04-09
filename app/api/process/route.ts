import { PDFDocument, degrees } from 'pdf-lib'
import { NextRequest } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const { pdfUrl, logoUrl, size, opacity, rotation } = await request.json()

    if (!pdfUrl || !logoUrl) {
      return Response.json({ error: 'Missing pdfUrl or logoUrl' }, { status: 400 })
    }

    const [pdfBuffer, logoBuffer] = await Promise.all([
      fetch(pdfUrl).then((r) => {
        if (!r.ok) throw new Error(`Failed to fetch PDF: ${r.status} ${r.statusText}`)
        return r.arrayBuffer()
      }),
      fetch(logoUrl).then((r) => {
        if (!r.ok) throw new Error(`Failed to fetch logo: ${r.status} ${r.statusText}`)
        return r.arrayBuffer()
      }),
    ])

    const pdfDoc = await PDFDocument.load(pdfBuffer)

    // Support both PNG and JPEG logos
    const isJpeg =
      logoUrl.toLowerCase().includes('.jpg') || logoUrl.toLowerCase().includes('.jpeg')
    const logoImage = isJpeg
      ? await pdfDoc.embedJpg(new Uint8Array(logoBuffer))
      : await pdfDoc.embedPng(new Uint8Array(logoBuffer))

    const { width: imgW, height: imgH } = logoImage.scale(1)

    const pages = pdfDoc.getPages()
    for (const page of pages) {
      const { width, height } = page.getSize()
      const logoWidth = width * (size / 100)
      const logoHeight = logoWidth * (imgH / imgW)

      const cx = width / 2
      const cy = height / 2

      // Rotate around the center of the image.
      // pdf-lib rotates around the image's bottom-left corner, so we adjust
      // the origin so the image center lands on the page center after rotation.
      // We negate rotation to match the CSS clockwise convention in the preview.
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
