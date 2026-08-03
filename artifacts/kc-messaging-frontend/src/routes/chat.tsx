import { FormEvent, useEffect, useMemo, useRef, useState, useCallback } from "react";
import * as api from "../lib/api";
import { useAuth } from "../lib/auth";
import { connectSocket, emitTypingStart, emitTypingStop, getSocket } from "../lib/socket";
import type { TypingUpdate } from "../lib/socket";

const TYPING_STOP_DELAY_MS = 2000;

function initials(label: string) {
  return label
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("") || "?";
}

function conversationLabel(conversation: api.Conversation, selfId: string) {
  if (conversation.title) return conversation.title;
  const others = conversation.participants.filter((p) => p.id !== selfId);
  if (others.length === 0) return "You";
  return others.map((p) => p.displayName || p.phone).join(", ");
}

function formatTime(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  if (sameDay) return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  return d.toLocaleDateString([], { month: "short", day: "numeric" });
}

export default function ChatRoute() {
  const { user, logout } = useAuth();
  const [conversations, setConversations] = useState<api.Conversation[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<api.Message[]>([]);
  const [draft, setDraft] = useState("");
  const [typingBy, setTypingBy] = useState<Set<string>>(new Set());
  const [loadingConversations, setLoadingConversations] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [showNewChat, setShowNewChat] = useState(false);
  const [newChatId, setNewChatId] = useState("");
  const [newChatError, setNewChatError] = useState<string | null>(null);
  const [sendError, setSendError] = useState<string | null>(null);

  const messageListRef = useRef<HTMLDivElement | null>(null);
  const typingStopTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wasTypingRef = useRef(false);

  const active = useMemo(
    () => conversations.find((c) => c.id === activeId) ?? null,
    [conversations, activeId],
  );

  // Initial conversation list
  useEffect(() => {
    let cancelled = false;
    setLoadingConversations(true);
    api
      .listConversations()
      .then((list) => {
        if (!cancelled) setConversations(list);
      })
      .finally(() => {
        if (!cancelled) setLoadingConversations(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Load message history whenever the active conversation changes
  useEffect(() => {
    if (!activeId) {
      setMessages([]);
      return;
    }
    let cancelled = false;
    setLoadingMessages(true);
    api
      .getMessages(activeId)
      .then((list) => {
        if (!cancelled) setMessages(list);
      })
      .finally(() => {
        if (!cancelled) setLoadingMessages(false);
      });
    api.markRead(activeId).catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [activeId]);

  useEffect(() => {
    messageListRef.current?.scrollTo({ top: messageListRef.current.scrollHeight });
  }, [messages, activeId]);

  // Realtime: message:new and typing:update from the /realtime namespace
  useEffect(() => {
    const socket = connectSocket();

    function onMessageNew(message: api.Message) {
      setConversations((prev) => {
        const next = prev.map((c) =>
          c.id === message.conversationId
            ? { ...c, lastMessage: message, updatedAt: message.createdAt }
            : c,
        );
        next.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
        return next;
      });
      setMessages((prev) => {
        if (message.conversationId !== activeIdRef.current) return prev;
        if (prev.some((m) => m.id === message.id)) return prev;
        return [...prev, message];
      });
      if (message.conversationId === activeIdRef.current) {
        api.markRead(message.conversationId).catch(() => {});
      }
    }

    function onTypingUpdate(update: TypingUpdate) {
      if (update.conversationId !== activeIdRef.current) return;
      if (update.userId === user?.id) return;
      setTypingBy((prev) => {
        const next = new Set(prev);
        if (update.typing) next.add(update.userId);
        else next.delete(update.userId);
        return next;
      });
    }

    socket.on("message:new", onMessageNew);
    socket.on("typing:update", onTypingUpdate);
    return () => {
      socket.off("message:new", onMessageNew);
      socket.off("typing:update", onTypingUpdate);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  // Keep a ref of the active conversation id for use inside the socket
  // handlers above, which are only wired up once.
  const activeIdRef = useRef<string | null>(null);
  useEffect(() => {
    activeIdRef.current = activeId;
    setTypingBy(new Set());
  }, [activeId]);

  const handleDraftChange = useCallback(
    (value: string) => {
      setDraft(value);
      if (!activeId) return;
      if (!wasTypingRef.current) {
        wasTypingRef.current = true;
        emitTypingStart(activeId);
      }
      if (typingStopTimer.current) clearTimeout(typingStopTimer.current);
      typingStopTimer.current = setTimeout(() => {
        wasTypingRef.current = false;
        emitTypingStop(activeId);
      }, TYPING_STOP_DELAY_MS);
    },
    [activeId],
  );

  async function handleSend(e: FormEvent) {
    e.preventDefault();
    const body = draft.trim();
    if (!body || !activeId) return;
    setSendError(null);
    setDraft("");
    if (typingStopTimer.current) clearTimeout(typingStopTimer.current);
    wasTypingRef.current = false;
    emitTypingStop(activeId);
    try {
      const message = await api.sendMessage(activeId, body);
      setMessages((prev) => (prev.some((m) => m.id === message.id) ? prev : [...prev, message]));
      setConversations((prev) => {
        const next = prev.map((c) =>
          c.id === activeId ? { ...c, lastMessage: message, updatedAt: message.createdAt } : c,
        );
        next.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
        return next;
      });
    } catch (err) {
      setSendError(err instanceof api.ApiError ? err.message : "Message didn't send. Try again.");
      setDraft(body);
    }
  }

  async function handleStartChat(e: FormEvent) {
    e.preventDefault();
    const id = newChatId.trim();
    if (!id) return;
    setNewChatError(null);
    try {
      const conversation = await api.createConversation([id]);
      setConversations((prev) => {
        if (prev.some((c) => c.id === conversation.id)) return prev;
        return [conversation, ...prev];
      });
      setActiveId(conversation.id);
      setShowNewChat(false);
      setNewChatId("");
    } catch (err) {
      setNewChatError(err instanceof api.ApiError ? err.message : "Couldn't start that chat.");
    }
  }

  const socketConnected = Boolean(getSocket()?.connected);

  return (
    <div className="app-shell" data-thread-open={activeId ? "true" : "false"}>
      <div className="conversation-pane">
        <div className="pane-header">
          <div className="pane-header-top">
            <h1>KC Messaging</h1>
            <div style={{ display: "flex", gap: 8 }}>
              <button
                className="icon-button"
                title="New chat"
                onClick={() => setShowNewChat((v) => !v)}
                aria-label="Start a new chat"
              >
                +
              </button>
              <button className="icon-button" title="Sign out" onClick={() => logout()} aria-label="Sign out">
                ⏻
              </button>
            </div>
          </div>
          <div className="woven-strip" style={{ opacity: socketConnected ? 0.9 : 0.25 }} />
        </div>

        {showNewChat && (
          <form className="new-chat-panel" onSubmit={handleStartChat}>
            <label className="field-label" htmlFor="new-chat-id">
              Start a chat with a user ID
            </label>
            <div className="row">
              <input
                id="new-chat-id"
                className="text-input"
                placeholder="user id"
                value={newChatId}
                onChange={(e) => setNewChatId(e.target.value)}
              />
              <button className="primary-button" type="submit" style={{ width: "auto", flexShrink: 0 }}>
                Start
              </button>
            </div>
            {newChatError && <div className="form-error">{newChatError}</div>}
          </form>
        )}

        <div className="conversation-list">
          {loadingConversations ? (
            <div className="empty-pane">
              <div className="woven-strip is-loading" />
            </div>
          ) : conversations.length === 0 ? (
            <div className="empty-pane">
              <div className="woven-strip" />
              <p>No conversations yet. Start one with a contact's user ID.</p>
            </div>
          ) : (
            conversations.map((c) => {
              const label = conversationLabel(c, user!.id);
              return (
                <button
                  key={c.id}
                  className={`conversation-row${c.id === activeId ? " is-active" : ""}`}
                  onClick={() => setActiveId(c.id)}
                >
                  <div className="avatar">{initials(label)}</div>
                  <div className="conversation-row-body">
                    <div className="conversation-row-top">
                      <span className="conversation-name">{label}</span>
                      {c.lastMessage && (
                        <span className="conversation-time">{formatTime(c.lastMessage.createdAt)}</span>
                      )}
                    </div>
                    <span className="conversation-preview">
                      {c.lastMessage ? c.lastMessage.body : "No messages yet"}
                    </span>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>

      <div className="thread-pane">
        {!active ? (
          <div className="empty-pane">
            <div className="woven-strip" />
            <p>Pick a conversation to start messaging.</p>
          </div>
        ) : (
          <>
            <div className="thread-header">
              <button className="back-button" onClick={() => setActiveId(null)} aria-label="Back to conversations">
                ←
              </button>
              <div className="avatar">{initials(conversationLabel(active, user!.id))}</div>
              <div>
                <h2>{conversationLabel(active, user!.id)}</h2>
                <div className="subtitle">{typingBy.size > 0 ? "typing…" : "\u00a0"}</div>
              </div>
            </div>

            <div className="message-list" ref={messageListRef}>
              {loadingMessages ? (
                <div className="empty-pane">
                  <div className="woven-strip is-loading" />
                </div>
              ) : (
                messages.map((m) => {
                  const isOwn = m.senderId === user!.id;
                  return (
                    <div key={m.id} className={`message-row${isOwn ? " is-own" : ""}`}>
                      <div className="message-bubble">
                        {m.body}
                        <span className="message-time">{formatTime(m.createdAt)}</span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <div className="typing-indicator">{typingBy.size > 0 && <div className="woven-strip" />}</div>

            {sendError && <div className="form-error" style={{ margin: "0 20px 10px" }}>{sendError}</div>}

            <form className="composer" onSubmit={handleSend}>
              <textarea
                rows={1}
                placeholder="Write a message"
                value={draft}
                onChange={(e) => handleDraftChange(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSend(e as unknown as FormEvent);
                  }
                }}
              />
              <button className="send-button" type="submit" disabled={!draft.trim()} aria-label="Send message">
                ↑
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
