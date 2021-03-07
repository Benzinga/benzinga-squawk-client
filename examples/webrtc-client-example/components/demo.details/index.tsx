import React from 'react'
import styles from './index.module.css'

export interface DemoDetailsProps {
  demoTitle: string
  demoInfo: string
}
const DemoDetails = ({ demoTitle, demoInfo }: DemoDetailsProps) => {
  return (
    <div className={styles.demo_details}>
      <div className={styles.demo_title}>{demoTitle}</div>
      <div className={styles.demo_info}>{demoInfo}</div>
    </div>
  )
}

export { DemoDetails }
