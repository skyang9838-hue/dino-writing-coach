'use client'

import { useEffect, useRef, useState } from 'react'

// The revision board's scrollable card track, split out of RevisionBoard.jsx
// so that only this wrapper ships to the browser — the cards themselves, and
// the `diff` library that renders them, stay on the server and arrive here as
// children.
//
// Above the cards sit a scrollbar and a pair of arrow buttons; the cards
// themselves can also be grabbed and pulled. The native scrollbar the track
// already had is at the foot of a column of text several screens tall, so
// none of this replaces it — it puts the controls where the teacher is
// already looking. The buttons carry the weight of announcing that the board
// scrolls at all, which neither a drag nor a far-off scrollbar manages.
//
// All of it is additive: the native scrollbar, the wheel, and the keyboard
// path (tabIndex + arrow keys) keep working exactly as they did.

// Under this many pixels a press is still a click or a double-click, not a
// drag — otherwise double-clicking a word would yank the track sideways.
const DRAG_THRESHOLD = 5

// scrollLeft comes back fractional (a drag measured 300.4444…), so the two
// scrollers are treated as agreeing when they are within a pixel. Comparing
// exactly would leave them nudging each other back and forth.
const SCROLL_EPSILON = 1

// How far one arrow click travels: the distance from one card to the next,
// measured off the rendered cards so the gap and the chevron between them are
// included without hardcoding either. Falls back to a screenful.
function cardStep(track) {
  const cards = track.querySelectorAll('.board-card')
  if (cards.length >= 2) return cards[1].offsetLeft - cards[0].offsetLeft
  return track.clientWidth
}

export function BoardTrack({ children }) {
  const trackRef = useRef(null)
  const scrollbarRef = useRef(null)
  const gesture = useRef(null)
  const [isDragging, setIsDragging] = useState(false)
  // Width of the spacer that gives the top scrollbar something to scroll.
  // 0 means the cards fit, and then no controls are drawn at all.
  const [spacerWidth, setSpacerWidth] = useState(0)
  const [atStart, setAtStart] = useState(true)
  const [atEnd, setAtEnd] = useState(false)
  const hasControls = spacerWidth > 0

  // Whether either arrow has anywhere left to go. Read straight off the DOM
  // so it stays right no matter which of the five ways the track moved.
  const readEdges = () => {
    const track = trackRef.current
    if (!track) return
    const remaining = track.scrollWidth - track.clientWidth - track.scrollLeft
    setAtStart(track.scrollLeft <= SCROLL_EPSILON)
    setAtEnd(remaining <= SCROLL_EPSILON)
  }

  // The card count is fixed, but their width is not: under 720px .board-card
  // drops to a 300px flex-basis, which changes how far the track can scroll.
  useEffect(() => {
    const track = trackRef.current
    if (!track) return

    const measure = () => {
      const maxScroll = track.scrollWidth - track.clientWidth
      // The scrollbar is narrower than the track — the buttons take a bite
      // out of the row. Sizing the spacer to the track's scrollWidth would
      // give the thumb further to travel than the cards can follow, so it
      // would hit its own end and spring back. Size it for equal travel
      // instead: the two then agree on every scrollLeft, including the last.
      const viewport = scrollbarRef.current?.clientWidth ?? track.clientWidth
      setSpacerWidth(maxScroll > SCROLL_EPSILON ? viewport + maxScroll : 0)
      readEdges()
    }

    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(track)
    // Only measurable once it has mounted, which is why hasControls is a
    // dependency: the first pass sizes the spacer from the track and the
    // second corrects it from the scrollbar itself. hasControls is a boolean,
    // so it settles after that one extra pass.
    if (scrollbarRef.current) observer.observe(scrollbarRef.current)
    return () => observer.disconnect()
  }, [children, hasControls])

  // Each scroller drives the other. Assigning a value that is already set
  // fires no scroll event, so guarding on "actually different" is what stops
  // the two from echoing each other forever.
  const syncFrom = (source, target) => {
    if (!source || !target) return
    if (Math.abs(source.scrollLeft - target.scrollLeft) < SCROLL_EPSILON) return
    target.scrollLeft = source.scrollLeft
  }

  const handleScrollbarScroll = () => syncFrom(scrollbarRef.current, trackRef.current)
  // Catches every other way the track moves — drag, wheel, arrow keys, the
  // buttons, and the track's own scrollbar underneath.
  const handleTrackScroll = () => {
    syncFrom(trackRef.current, scrollbarRef.current)
    readEdges()
  }

  const scrollByCard = (direction) => {
    const track = trackRef.current
    if (!track) return
    // Animating is a nicety, so it is the first thing dropped for anyone who
    // has asked the system for less motion.
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    track.scrollBy({ left: direction * cardStep(track), behavior: reduced ? 'auto' : 'smooth' })
  }

  const handlePointerDown = (event) => {
    // Touch already has native momentum scrolling and taking it over only
    // makes it worse. For the same reason the CSS never sets touch-action.
    if (event.pointerType === 'touch' || event.button !== 0) return
    // The student's writing stays selectable — teachers copy sentences out of
    // it, so a drag that starts there belongs to the browser, not to us.
    if (event.target.closest?.('.board-writing-text')) return

    gesture.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startScrollLeft: trackRef.current.scrollLeft,
      dragging: false,
    }
  }

  const handlePointerMove = (event) => {
    const drag = gesture.current
    if (!drag || drag.pointerId !== event.pointerId) return

    const dx = event.clientX - drag.startX

    if (!drag.dragging) {
      if (Math.abs(dx) < DRAG_THRESHOLD) return
      drag.dragging = true
      // Capture so the drag survives the pointer leaving the track.
      trackRef.current.setPointerCapture(event.pointerId)
      // Whatever the browser started selecting before the threshold was
      // crossed would otherwise sit there highlighted for the whole drag.
      window.getSelection()?.removeAllRanges()
      setIsDragging(true)
    }

    trackRef.current.scrollLeft = drag.startScrollLeft - dx
  }

  const handlePointerEnd = (event) => {
    const drag = gesture.current
    if (!drag || drag.pointerId !== event.pointerId) return

    if (drag.dragging) {
      if (trackRef.current.hasPointerCapture(event.pointerId)) {
        trackRef.current.releasePointerCapture(event.pointerId)
      }
      setIsDragging(false)
    }
    gesture.current = null
  }

  return (
    <>
      {/* One button at each end of the cards, pointing the way they move.
          Bunched together they read as a pager sitting off to one side;
          split apart they read as the two edges of the board. */}
      {hasControls && (
        <div className="board-scroll-controls">
          <button
            type="button"
            className="board-scroll-button"
            onClick={() => scrollByCard(-1)}
            disabled={atStart}
            aria-label="이전 수정 보기"
          >
            ‹
          </button>

          {/* The scrollbar duplicates a control the track already offers, so
              it is hidden from assistive tech and kept out of the tab order
              rather than announced twice. The buttons are the opposite: they
              are named and focusable, because for a lot of people they are
              the only sign the board goes anywhere. */}
          <div
            ref={scrollbarRef}
            className="board-scrollbar"
            aria-hidden="true"
            tabIndex={-1}
            onScroll={handleScrollbarScroll}
          >
            <div className="board-scrollbar-spacer" style={{ width: spacerWidth }} />
          </div>

          <button
            type="button"
            className="board-scroll-button"
            onClick={() => scrollByCard(1)}
            disabled={atEnd}
            aria-label="다음 수정 보기"
          >
            ›
          </button>
        </div>
      )}

      <div
        ref={trackRef}
        className={`board-track${isDragging ? ' board-track-dragging' : ''}`}
        tabIndex={0}
        role="group"
        aria-label="수정 라운드"
        onScroll={handleTrackScroll}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerEnd}
        onPointerCancel={handlePointerEnd}
      >
        {children}
      </div>
    </>
  )
}
