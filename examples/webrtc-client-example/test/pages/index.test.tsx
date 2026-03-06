import React from 'react'
import { render, fireEvent } from '../testUtils'
import Home from '../../pages/index'

describe('Home page', () => {
  it('matches snapshot', () => {
    const { asFragment } = render(<Home />, {})
    expect(asFragment()).toMatchSnapshot()
  })

  it('renders the SDK Demo title', () => {
    const { getByText } = render(<Home />, {})
    expect(getByText('SDK Demo')).toBeTruthy()
  })

  it('renders the Broadcaster demo link', () => {
    const { getByText } = render(<Home />, {})
    expect(getByText('Broadcaster demo')).toBeTruthy()
  })

  /** 
  it('clicking button triggers alert', () => {
    const { getByText } = render(<Home />, {})
    window.alert = jest.fn()
    fireEvent.click(getByText('Test Button'))
    expect(window.alert).toHaveBeenCalledWith('With typescript and Jest')
  })
  */
})
