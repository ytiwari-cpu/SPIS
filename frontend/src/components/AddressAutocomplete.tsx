/**
 * ADDRESS AUTOCOMPLETE COMPONENT
 * 
 * A reusable address autocomplete component using OpenStreetMap Nominatim API.
 * Restricted to Jamaica for address suggestions.
 * FREE - No API key required!
 * 
 * Props:
 * - onSelect: Callback when an address is selected with parsed data
 * - placeholder: Optional placeholder text
 * - className: Optional additional CSS classes
 * 
 * Parses Nominatim results to extract:
 * - line1: house_number + road
 * - parish: state (e.g., St. Andrew Parish)
 * - district: suburb, neighbourhood, or city
 * - geo_code: lat,lng string
 */

import { useState, useRef, useEffect } from 'react'

interface AddressData {
  line1: string
  parish: string
  district: string
  geo_code?: string
}

interface AddressAutocompleteProps {
  onSelect: (data: AddressData) => void
  placeholder?: string
  className?: string
  defaultValue?: string
}

// Nominatim API result interface
interface NominatimResult {
  place_id: number
  display_name: string
  lat: string
  lon: string
  address: {
    house_number?: string
    road?: string
    suburb?: string
    neighbourhood?: string
    city?: string
    town?: string
    village?: string
    state?: string
    county?: string
    postcode?: string
    country?: string
  }
}

// Parse Nominatim result to our AddressData format
function parseNominatimResult(result: NominatimResult): AddressData {
  const addr = result.address
  
  // Build line1 from house_number + road
  const line1 = [addr.house_number, addr.road].filter(Boolean).join(' ')
  
  // Parish is the state in Jamaica (e.g., "St. Andrew Parish")
  const parish = addr.state || addr.county || ''
  
  // District: prefer suburb, then neighbourhood, then city/town/village
  const district = addr.suburb || addr.neighbourhood || addr.city || addr.town || addr.village || ''
  
  // Build geo_code from lat,lon
  const geoCode = `${result.lat},${result.lon}`
  
  return {
    line1,
    parish,
    district,
    geo_code: geoCode,
  }
}

export default function AddressAutocomplete({
  onSelect,
  placeholder = 'Start typing an address...',
  className = '',
  defaultValue = '',
}: AddressAutocompleteProps) {
  const [inputValue, setInputValue] = useState(defaultValue)
  const [predictions, setPredictions] = useState<NominatimResult[]>([])
  const [isOpen, setIsOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState(-1)
  
  const inputRef = useRef<HTMLInputElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const abortControllerRef = useRef<AbortController | null>(null)

  // Handle click outside to close dropdown
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        dropdownRef.current && 
        !dropdownRef.current.contains(event.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Fetch predictions from Nominatim API
  const fetchPredictions = async (input: string) => {
    if (input.length < 3) {
      setPredictions([])
      setIsOpen(false)
      return
    }

    // Cancel any pending request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }
    abortControllerRef.current = new AbortController()

    setIsLoading(true)
    
    try {
      // Nominatim API - restricted to Jamaica (countrycodes=jm)
      const params = new URLSearchParams({
        q: input,
        format: 'json',
        addressdetails: '1',
        countrycodes: 'jm', // Restrict to Jamaica
        limit: '5',
      })
      
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?${params}`,
        {
          signal: abortControllerRef.current.signal,
          headers: {
            'Accept': 'application/json',
            // Nominatim requires a User-Agent
            'User-Agent': 'SPIS-Family-Registration/1.0',
          },
        }
      )
      
      if (!response.ok) {
        throw new Error('Failed to fetch addresses')
      }
      
      const results: NominatimResult[] = await response.json()
      setPredictions(results)
      setIsOpen(results.length > 0)
      setSelectedIndex(-1)
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        console.error('Error fetching predictions:', err)
        setPredictions([])
      }
    } finally {
      setIsLoading(false)
    }
  }

  // Debounce input changes
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    setInputValue(value)
    
    if (debounceRef.current) {
      clearTimeout(debounceRef.current)
    }
    
    debounceRef.current = setTimeout(() => {
      fetchPredictions(value)
    }, 400) // Slightly longer debounce for Nominatim rate limits
  }

  // Handle selection of a prediction
  const handleSelect = (result: NominatimResult) => {
    // Set the display name (first part before Jamaica)
    const displayParts = result.display_name.split(',')
    const displayText = displayParts.slice(0, 3).join(',').trim()
    setInputValue(displayText)
    setIsOpen(false)
    setPredictions([])
    
    const addressData = parseNominatimResult(result)
    
    // If line1 is empty, use the first part of display_name
    if (!addressData.line1) {
      addressData.line1 = displayParts[0]?.trim() || ''
    }
    
    onSelect(addressData)
  }

  // Handle keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isOpen || predictions.length === 0) return
    
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        setSelectedIndex(prev => 
          prev < predictions.length - 1 ? prev + 1 : prev
        )
        break
      case 'ArrowUp':
        e.preventDefault()
        setSelectedIndex(prev => prev > 0 ? prev - 1 : 0)
        break
      case 'Enter':
        e.preventDefault()
        if (selectedIndex >= 0 && predictions[selectedIndex]) {
          handleSelect(predictions[selectedIndex])
        }
        break
      case 'Escape':
        setIsOpen(false)
        setSelectedIndex(-1)
        break
    }
  }

  // Get main text and secondary text from display_name
  const formatDisplayName = (displayName: string) => {
    const parts = displayName.split(',').map(p => p.trim())
    const mainText = parts[0] || ''
    const secondaryText = parts.slice(1, 4).join(', ') // Show next 3 parts
    return { mainText, secondaryText }
  }

  return (
    <div className={`relative ${className}`}>
      <div className="relative">
        <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-lg">
          search
        </span>
        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onFocus={() => predictions.length > 0 && setIsOpen(true)}
          placeholder={placeholder}
          className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors bg-white dark:bg-gray-800 dark:border-gray-700 dark:text-white"
          autoComplete="off"
          aria-label="Address search"
          aria-expanded={isOpen}
          aria-haspopup="listbox"
          role="combobox"
        />
        {isLoading && (
          <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 animate-spin text-lg">
            progress_activity
          </span>
        )}
      </div>

      {/* Predictions Dropdown */}
      {isOpen && predictions.length > 0 && (
        <div 
          ref={dropdownRef}
          className="absolute z-50 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg max-h-60 overflow-y-auto"
          role="listbox"
        >
          {predictions.map((result, index) => {
            const { mainText, secondaryText } = formatDisplayName(result.display_name)
            return (
              <button
                key={result.place_id}
                type="button"
                onClick={() => handleSelect(result)}
                onMouseEnter={() => setSelectedIndex(index)}
                className={`w-full text-left px-4 py-3 flex items-start gap-3 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors
                  ${selectedIndex === index ? 'bg-gray-100 dark:bg-gray-700' : ''}`}
                role="option"
                aria-selected={selectedIndex === index}
              >
                <span className="material-symbols-outlined text-gray-400 text-lg mt-0.5">
                  location_on
                </span>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-gray-900 dark:text-white truncate">
                    {mainText}
                  </div>
                  <div className="text-sm text-gray-500 dark:text-gray-400 truncate">
                    {secondaryText}
                  </div>
                </div>
              </button>
            )
          })}
          
          {/* OpenStreetMap Attribution (required by Nominatim usage policy) */}
          <div className="px-4 py-2 border-t border-gray-200 dark:border-gray-700 flex justify-end">
            <a 
              href="https://www.openstreetmap.org/copyright"
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            >
              © OpenStreetMap contributors
            </a>
          </div>
        </div>
      )}
    </div>
  )
}
