import { PDFDocument, degrees } from 'pdf-lib'
import { NextRequest } from 'next/server'

export async function POST(request: NextRequest) {
  const { pdfUrl, logoUrl, size, opacity, rotation } = await request.json()

  if (!pdfUrl || !logoUrl) {
    return Response.json({ error: 'Missing pdfUrl or logoUrl' }, { status: 400 })
  }

  const [pdfBuffer, logoBuffer] = await Promise.all([
    fetch(pdfUrl).then((r) => r.arrayBuffer()),
    fetch(logoUrl).then((r) => r.arrayBuffer()),
  ])

  const pdfDoc = await PDFDocument.load(pdfBuffer)

  // Support both PNG and JPEG logos
  const isJpeg =
    logoUrl.toLowerCase().endsWith('.jpg') || logoUrl.toLowerCase().endsWith('.jpeg')
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

    // Rotate around the center of the image by computing the adjusted origin.
    // pdf-lib rotates around the image's bottom-left corner, so we offset
    // so that the image center lands on the page center after rotation.
    // PDF rotation is counterclockwise (math convention); we negate to match
    // the CSS clockwise convention shown in the browser preview.
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
}
