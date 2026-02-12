import { useState, useEffect } from "react"

/**
 * A custom hook to debounce a value.
 * @param value The value to debounce.
 * @param delay The debounce delay in milliseconds.
 * @returns The debounced value.
 */
export function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value)

  useEffect(() => {
    // Cập nhật giá trị debounced sau một khoảng thời gian delay
    const handler = setTimeout(() => {
      setDebouncedValue(value)
    }, delay)

    // Hủy timeout nếu value thay đổi (ví dụ: người dùng tiếp tục gõ)
    return () => clearTimeout(handler)
  }, [value, delay]) // Chỉ chạy lại effect nếu value hoặc delay thay đổi

  return debouncedValue
}