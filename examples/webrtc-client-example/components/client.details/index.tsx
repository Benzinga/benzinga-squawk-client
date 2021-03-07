import React, { ChangeEvent } from 'react'
import styles from './index.module.css'
import { keyOptionList } from '../../library/constants'

export interface ClientDetailsProps {
  streamId?: string
  setStreamId?: Function
  apiKey: string
  setApiKey: Function
  apiKeyType: string
  setApiKeyType: Function
  showChannel: boolean
}
const ClientDetails = ({
  setApiKey,
  setApiKeyType,
  apiKey,
  apiKeyType,
  setStreamId,
  streamId,
  showChannel,
}: ClientDetailsProps) => {
  return (
    <div className={styles.container}>
      <div className={styles.input_container}>
        <div className={styles.name}>{'Key Type'}</div>
        <div className={styles.details}>
          <select id="lang" onChange={(e) => setApiKeyType(e.target.value)} value={apiKeyType}>
            {keyOptionList.map((currentOption, optionIndex) => (
              <option value={currentOption.value} key={optionIndex}>
                {currentOption.label}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className={styles.input_container}>
        <div className={styles.name}>{'API Key'}</div>
        <div className={styles.details}>
          <input
            type="text"
            value={apiKey}
            onChange={(e: ChangeEvent<HTMLInputElement>) => setApiKey(e.currentTarget.value)}
          />
        </div>
      </div>
      {showChannel && (
        <div className={styles.input_container}>
          <div className={styles.name}>{'Channel ID'}</div>
          <div className={styles.details}>
            <input
              type="text"
              value={streamId}
              onChange={(e: ChangeEvent<HTMLInputElement>) => setStreamId(e.currentTarget.value)}
            />
          </div>
        </div>
      )}
    </div>
  )
}

export { ClientDetails }
