import React from 'react'

export interface MarginProps {
  bottom?: string
  top?: string
}

const getMargin = (top, bottom) => {
  return {
    ...(top && { marginTop: top }),
    ...(bottom && { marginBottom: bottom }),
  }
}
const Margin = ({ top, bottom }: MarginProps) => {
  return <div style={getMargin(top, bottom)} />
}

export { Margin }
