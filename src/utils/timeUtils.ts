export const convertToIST = (time: string): string => {
  const [hours, minutes] = time.split(':')
  const date = new Date()
  date.setHours(parseInt(hours), parseInt(minutes))

  return date.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
    timeZone: 'Asia/Kolkata'
  })
}

export const convertToUTC = (time: string): string => {
  const [hours, minutes, period] = time.match(/(\d+):(\d+)\s*(AM|PM)/i)?.slice(1) || []
  let hour = parseInt(hours)

  if (period === 'PM' && hour !== 12) hour += 12
  if (period === 'AM' && hour === 12) hour = 0

  const date = new Date()
  date.setHours(hour, parseInt(minutes))

  return date.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'UTC'
  })
}

export const getCurrentISTTime = (): string => {
  return new Date().toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
    timeZone: 'Asia/Kolkata'
  })
}

// Get current date in IST timezone in YYYY-MM-DD format
export const getCurrentISTDate = (): string => {
  return new Date().toLocaleDateString('en-CA', { 
    year: 'numeric',
    month: '2-digit', 
    day: '2-digit',
    timeZone: 'Asia/Kolkata' 
  })
}

// For time comparisons in the component
export const parseISTTime = (time: string): Date => {
  const today = getCurrentISTDate()
  const date = new Date(`${today}T${time}`)
  return date
}