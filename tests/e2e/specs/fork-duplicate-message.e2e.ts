/**
 * Fork Duplicate Message Regression Test
 *
 * Verifies that forking a conversation does not duplicate the user message
 * that triggered the fork. The bug: client-side pendingBackgroundMessageRef
 * generates different IDs than the fork() WebSocket command, so the server's
 * user_step_saved event doesn't match the optimistic message and creates
 * a second copy.
 */

import { test, expect } from '@playwright/test';
import { ChatPage, HomePage } from '../helpers/page-objects';
import { stopAllActiveRunsFromHome } from '../helpers/cleanup';

test.describe('Fork Duplicate Message', () => {
    test.afterEach(async ({ page }) => {
        await stopAllActiveRunsFromHome(page);
    });

    test('forking a conversation should not duplicate the fork query', async ({ page }) => {
        const chatPage = new ChatPage(page);
        const homePage = new HomePage(page);

        // 1. Start a foreground conversation and wait for it to complete
        await chatPage.goto();
        await chatPage.sendMessage('you good');
        await chatPage.waitForAssistantResponse();

        let messageCount = await chatPage.getMessageCount();
        expect(messageCount.user).toBe(1);
        expect(messageCount.assistant).toBe(1);

        // 2. Fork with a slow query so the run is still active when we navigate to it.
        //    "pausable" triggers the slow mock (1s x 10 iterations).
        const forkQuery = 'run a pausable analysis';
        await chatPage.sendBackgroundMessage(forkQuery);

        // 3. Go to home (SPA nav, preserves client state) and wait for the fork task
        await chatPage.goHome();
        await homePage.waitForTaskWithTitle(forkQuery);

        // 4. Click the forked task card (by title) to switch to forked conversation.
        //    This dispatches SET_CONVERSATION_ID which reads from conversationStates
        //    — the same state where the duplicate user message would live.
        await homePage.getTaskCardByTitle(forkQuery).click();

        // Wait for the conversation to render with the fork query's user message
        await page.waitForFunction(
            (query) => {
                const userMessages = document.querySelectorAll('.user-message .message-content');
                return Array.from(userMessages).some(el => el.textContent?.includes(query));
            },
            forkQuery,
            { timeout: 10000 }
        );

        // 5. Count user messages: should be "you good" (from source) + fork query (fork trigger)
        //    If the fork query is duplicated, we'd see 3 user messages instead of 2.
        const userMessages = await chatPage.getUserMessages();
        const forkQueryOccurrences = userMessages.filter(m => m.includes('pausable'));

        expect(forkQueryOccurrences).toHaveLength(1);
    });
});
