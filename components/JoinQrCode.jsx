'use client'

import { QRCodeSVG } from 'qrcode.react'

export function JoinQrCode({ url }) {
  return (
    <div className="qr-wrapper">
      <QRCodeSVG value={url} size={180} />
    </div>
  )
}
