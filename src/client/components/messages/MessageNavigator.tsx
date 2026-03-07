// Floating pill to jump between user/assistant messages in a conversation

import { useState, useCallback, useRef, useEffect } from 'react';
import { ChevronUp, ChevronDown } from 'lucide-react';

interface MessageNavigatorProps {
    messageIndices: number[];
    scrollContainerRef: React.RefObject<HTMLElement | null>;
    messageRefs: React.RefObject<Map<number, HTMLElement>>;
}

const LONG_PRESS_MS = 400;
const IDLE_HIDE_MS = 1500;
// How long to ignore scroll events after a programmatic scroll
const PROGRAMMATIC_SCROLL_LOCK_MS = 600;

export function MessageNavigator({ messageIndices, scrollContainerRef, messageRefs }: MessageNavigatorProps) {
    const [currentIndex, setCurrentIndex] = useState(-1);
    const [visible, setVisible] = useState(false);
    const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const isLongPressRef = useRef(false);
    const isHoveredRef = useRef(false);
    const navRef = useRef<HTMLDivElement>(null);
    // Suppress scroll-based index updates during programmatic scrolls
    const scrollLockUntilRef = useRef(0);

    const count = messageIndices.length;

    const showTemporarily = useCallback(() => {
        setVisible(true);
        if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
        idleTimerRef.current = setTimeout(() => {
            if (!isHoveredRef.current) setVisible(false);
        }, IDLE_HIDE_MS);
    }, []);

    // Get the scroll-relevant element: .message-content for assistant messages, wrapper for user
    const getScrollAnchor = useCallback((el: HTMLElement): HTMLElement => {
        const assistantMsg = el.querySelector('.assistant-message');
        const content = assistantMsg?.querySelector('.message-content');
        return (content as HTMLElement) ?? el;
    }, []);

    const getAnchorTopInContainer = useCallback((anchor: HTMLElement, container: HTMLElement): number => {
        const anchorRect = anchor.getBoundingClientRect();
        const containerRect = container.getBoundingClientRect();
        return container.scrollTop + (anchorRect.top - containerRect.top);
    }, []);

    const findClosest = useCallback(() => {
        const container = scrollContainerRef.current;
        const refs = messageRefs.current;
        if (!container || !refs) return -1;

        const containerMid = container.scrollTop + container.clientHeight * 0.35;
        let closestIdx = 0;
        let closestDist = Infinity;

        for (let i = 0; i < messageIndices.length; i++) {
            const idx = messageIndices[i];
            if (idx === undefined) continue;
            const el = refs.get(idx);
            if (!el) continue;
            const anchor = getScrollAnchor(el);
            const anchorTop = getAnchorTopInContainer(anchor, container);
            const dist = Math.abs(anchorTop - containerMid);
            if (dist < closestDist) {
                closestDist = dist;
                closestIdx = i;
            }
        }
        return closestIdx;
    }, [scrollContainerRef, messageRefs, messageIndices, getScrollAnchor, getAnchorTopInContainer]);

    // Track which message is nearest to viewport on user-initiated scroll
    useEffect(() => {
        const container = scrollContainerRef.current;
        if (!container || count === 0) return;

        const onScroll = () => {
            // Skip index updates during programmatic scroll animation
            if (Date.now() < scrollLockUntilRef.current) {
                showTemporarily();
                return;
            }
            setCurrentIndex(findClosest());
            showTemporarily();
        };

        container.addEventListener('scroll', onScroll, { passive: true });
        setCurrentIndex(findClosest());

        return () => container.removeEventListener('scroll', onScroll);
    }, [scrollContainerRef, count, showTemporarily, findClosest]);

    const scrollToMessage = useCallback((msgIdx: number) => {
        const index = messageIndices[msgIdx];
        if (index === undefined) return;
        const el = messageRefs.current?.get(index);
        if (!el) return;
        const scrollTarget = getScrollAnchor(el);
        scrollLockUntilRef.current = Date.now() + PROGRAMMATIC_SCROLL_LOCK_MS;
        scrollTarget.scrollIntoView({ behavior: 'smooth', block: 'start' });
        setCurrentIndex(msgIdx);
    }, [messageIndices, messageRefs, getScrollAnchor]);

    const goUp = useCallback(() => {
        scrollToMessage(Math.max(0, currentIndex - 1));
    }, [currentIndex, scrollToMessage]);

    const goDown = useCallback(() => {
        scrollToMessage(Math.min(count - 1, currentIndex + 1));
    }, [currentIndex, count, scrollToMessage]);

    const jumpToFirst = useCallback(() => scrollToMessage(0), [scrollToMessage]);
    const jumpToLast = useCallback(() => scrollToMessage(count - 1), [count, scrollToMessage]);

    const startPress = useCallback((direction: 'up' | 'down') => {
        isLongPressRef.current = false;
        longPressTimerRef.current = setTimeout(() => {
            isLongPressRef.current = true;
            if (direction === 'up') jumpToFirst();
            else jumpToLast();
        }, LONG_PRESS_MS);
    }, [jumpToFirst, jumpToLast]);

    const clearPressTimer = useCallback(() => {
        if (longPressTimerRef.current) {
            clearTimeout(longPressTimerRef.current);
            longPressTimerRef.current = null;
        }
    }, []);

    const handleClick = useCallback((direction: 'up' | 'down') => {
        if (isLongPressRef.current) {
            isLongPressRef.current = false;
            return;
        }

        if (direction === 'up') goUp();
        else goDown();
    }, [goUp, goDown]);

    // Keyboard shortcuts: Cmd/Ctrl+j/k to navigate, +Shift to jump to first/last
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (count === 0) return;
            if (!(e.metaKey || e.ctrlKey) || e.altKey) return;

            if (e.key === 'j') { e.shiftKey ? jumpToLast() : goDown(); e.preventDefault(); }
            else if (e.key === 'k') { e.shiftKey ? jumpToFirst() : goUp(); e.preventDefault(); }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [count, goUp, goDown, jumpToFirst, jumpToLast]);

    useEffect(() => {
        return () => {
            if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
            if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
        };
    }, []);

    const atTop = currentIndex <= 0;
    const atBottom = currentIndex >= count - 1;

    return (
        <div
            ref={navRef}
            className={`message-navigator ${visible ? 'message-navigator-visible' : ''}`}
            onMouseEnter={() => {
                isHoveredRef.current = true;
                if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
                setVisible(true);
            }}
            onMouseLeave={() => {
                isHoveredRef.current = false;
                showTemporarily();
            }}
        >
            <button
                className={`message-nav-btn ${atTop ? 'message-nav-btn-disabled' : ''}`}
                onPointerDown={() => !atTop && startPress('up')}
                onPointerUp={() => !atTop && clearPressTimer()}
                onPointerCancel={clearPressTimer}
                onPointerLeave={clearPressTimer}
                onClick={() => !atTop && handleClick('up')}
                disabled={atTop}
                title="Previous message (hold for first)"
                aria-label="Previous message"
            >
                <ChevronUp size={14} />
            </button>
            <span className="message-nav-counter">
                {currentIndex + 1}<span className="message-nav-separator">/</span>{count}
            </span>
            <button
                className={`message-nav-btn ${atBottom ? 'message-nav-btn-disabled' : ''}`}
                onPointerDown={() => !atBottom && startPress('down')}
                onPointerUp={() => !atBottom && clearPressTimer()}
                onPointerCancel={clearPressTimer}
                onPointerLeave={clearPressTimer}
                onClick={() => !atBottom && handleClick('down')}
                disabled={atBottom}
                title="Next message (hold for last)"
                aria-label="Next message"
            >
                <ChevronDown size={14} />
            </button>
        </div>
    );
}
