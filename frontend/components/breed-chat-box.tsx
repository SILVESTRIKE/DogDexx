"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import { motion, AnimatePresence, PanInfo } from "framer-motion";
import { useI18n } from "@/lib/i18n-context";
import { useAuth } from "@/lib/auth-context";
import { Send, User, X, Sparkles } from "lucide-react";
import { apiClient } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { toast } from "sonner";

interface Message {
  role: "user" | "model";
  content: string;
}

function SimpleMarkdownRenderer({ text }: { text: string }) {
  const lines = text.split("\n");
  return (
    <div className="space-y-2">
      {lines.map((line, i) => {
        if (line.startsWith("### "))
          return (
            <h3 key={i} className="text-md font-semibold mt-3 mb-1">
              {line.substring(4)}
            </h3>
          );
        if (line.startsWith("## "))
          return (
            <h2 key={i} className="text-lg font-bold mt-3 mb-1">
              {line.substring(3)}
            </h2>
          );
        if (line.startsWith("# "))
          return (
            <h1 key={i} className="text-xl font-extrabold mt-3 mb-1">
              {line.substring(2)}
            </h1>
          );
        const parts = line.split(/(\*\*.*?\*\*)/g);
        return (
          <p key={i} className="whitespace-pre-wrap leading-relaxed">
            {parts.map((part, j) =>
              part.startsWith("**") && part.endsWith("**") ? (
                <strong key={j}>{part.slice(2, -2)}</strong>
              ) : (
                part
              )
            )}
          </p>
        );
      })}
    </div>
  );
}

interface BreedChatBoxProps {
  breedSlug: string;
  breedName: string;
  initialMessage?: string;
}

export function BreedChatBox({
  breedSlug,
  breedName,
  initialMessage,
}: BreedChatBoxProps) {
  const { t, locale } = useI18n();
  const { user, isAuthenticated, refetchUser } = useAuth();
  const [messages, setMessages] = useState<Message[]>(
    initialMessage ? [{ role: "model", content: initialMessage }] : []
  );
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  const buttonRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ x: 0, y: 96 }); // Start at top-left
  const [isMounted, setIsMounted] = useState(false);
  const [snapEdge, setSnapEdge] = useState<"left" | "right" | "none">("left");
  const [constraints, setConstraints] = useState({
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  });

  // CẬP NHẬT: Lấy số token còn lại từ context
  const remainingTokens = user?.remainingTokens ?? 0;

  const pointerDownInfo = useRef<{ x: number; y: number; time: number } | null>(
    null
  );

  useEffect(() => {
    setIsMounted(true);
    const updateConstraints = () => {
      if (buttonRef.current) {
        const { offsetWidth, offsetHeight } = buttonRef.current;
        setConstraints({
          top: 0,
          left: 0,
          right: window.innerWidth - offsetWidth,
          bottom: window.innerHeight - offsetHeight,
        });
      }
    };
    updateConstraints(); // Cập nhật lần đầu
    window.addEventListener("resize", updateConstraints);
    return () => window.removeEventListener("resize", updateConstraints);
  }, [isMounted, snapEdge]); // Cập nhật lại khi kích thước button thay đổi (do snapEdge)

  // TẢI LỊCH SỬ CHAT KHI MỞ COMPONENT
  useEffect(() => {
    const fetchHistory = async () => {
      try {
        setIsLoading(true);
        const { history } = await apiClient.getChatHistory(breedSlug);
        const formattedMessages: Message[] = history.map((item) => ({
          role: item.role,
          content: item.parts[0].text,
        }));
        // Chỉ set message nếu có lịch sử, nếu không thì giữ lại initialMessage
        if (formattedMessages.length > 0) {
          setMessages(formattedMessages);
        }
      } catch (error) {
        toast.error("Could not load chat history.", {
          description: (error as Error).message,
        });
      } finally {
        setIsLoading(false);
      }
    };

    if (isOpen) {
      fetchHistory();
    }
  }, [isOpen, breedSlug]);

  useEffect(() => {
    if (scrollAreaRef.current) {
      scrollAreaRef.current.scrollTo({
        top: scrollAreaRef.current.scrollHeight,
        behavior: "smooth",
      });
    }
  }, [messages]);

  const getPanelPosition = () => {
    const panelWidth = 384; // Corresponds to max-w-sm
    const panelHeight = 550; // Chiều cao ước tính của panel chat
    const margin = 16; // Corresponds to right-4
    let panelX = pos.x;
    let panelY = pos.y;

    // Điều chỉnh theo chiều ngang (X)
    if (pos.x + panelWidth > window.innerWidth) {
      panelX = window.innerWidth - panelWidth - margin;
    }
    // Điều chỉnh theo chiều dọc (Y)
    if (pos.y + panelHeight > window.innerHeight) {
      panelY = window.innerHeight - panelHeight - margin;
    }
    return { x: panelX, y: panelY };
  };
  const submitMessage = async (messageContent: string) => {
    if (!messageContent.trim() || isLoading || remainingTokens <= 0) return;
    const userMessage: Message = { role: "user", content: messageContent };
    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);
    try {
      const { reply } = await apiClient.chatWithBreed(
        breedSlug,
        messageContent,
        locale
      );
      // CẬP NHẬT: Nếu người dùng đã đăng nhập, làm mới thông tin để cập nhật token
      if (isAuthenticated) {
        await refetchUser();
      }
      setMessages((prev) => [...prev, { role: "model", content: reply }]);
    } catch (error) {
      toast.error("Failed to get response from AI.", {
        description: (error as Error).message,
      });
      setInput(messageContent);
      setMessages((prev) => prev.slice(0, -1));
    } finally {
      setIsLoading(false);
    }
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    submitMessage(input);
  };

  const samplePrompts = useMemo(
    () => [
      t("results.chatWithAI.prompts.funFact"),
      t("results.chatWithAI.prompts.diet", { breedName }),
      t("results.chatWithAI.prompts.activities"),
      t("results.chatWithAI.prompts.apartment"),
    ],
    [t, breedName]
  );

  const handlePointerDown = (e: React.PointerEvent) => {
    pointerDownInfo.current = { x: e.clientX, y: e.clientY, time: Date.now() };
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (!pointerDownInfo.current) return;
    const { x, y, time } = pointerDownInfo.current;
    const distance = Math.sqrt(
      Math.pow(e.clientX - x, 2) + Math.pow(e.clientY - y, 2)
    );
    const duration = Date.now() - time;
    if (distance < 10 && duration < 200) {
      setIsOpen(true);
    }
    pointerDownInfo.current = null;
  };

  const handleDrag = (_: any, info: PanInfo) => {
    if (!buttonRef.current) return;
    const { x } = info.point;
    const edgeThreshold = 100;
    if (x < edgeThreshold) {
      if (snapEdge !== "left") setSnapEdge("left");
    } else if (x > window.innerWidth - edgeThreshold) {
      if (snapEdge !== "right") setSnapEdge("right");
    } else {
      if (snapEdge !== "none") setSnapEdge("none");
    }
  };

  const handleDragEnd = (_: any, info: PanInfo) => {
    const snapThreshold = 120;
    let newX = info.point.x;
    let newY = info.point.y;
    let finalSnapEdge: "left" | "right" | "none" = "none";
    const buttonWidth = buttonRef.current?.offsetWidth || 50; // Lấy chiều rộng hiện tại của button
    const buttonHeight = buttonRef.current?.offsetHeight || 50;

    // Snap logic
    if (info.point.x < snapThreshold) {
      newX = 0; // Snap to the very left edge
      finalSnapEdge = "left";
    } else if (info.point.x > window.innerWidth - buttonWidth - snapThreshold) {
      newX = window.innerWidth - buttonWidth; // Snap to the very right edge
      finalSnapEdge = "right";
    }

    // Constrain position within viewport
    const constrainedX = Math.max(
      0,
      Math.min(newX, window.innerWidth - buttonWidth)
    );
    const constrainedY = Math.max(
      0,
      Math.min(newY, window.innerHeight - buttonHeight)
    );

    // Cập nhật lại newX và newY sau khi đã giới hạn
    newX = constrainedX;
    newY = constrainedY;

    setPos({ x: newX, y: newY });
    setSnapEdge(finalSnapEdge);
  };

  if (!isMounted) return null;

  return (
    <>
      {!isOpen && (
        <motion.div
          ref={buttonRef}
          drag
          dragElastic={0} // 🟢 SỬA LỖI: Ngăn không cho kéo ra ngoài giới hạn
          dragMomentum={false} // Giúp dừng lại ngay khi thả chuột
          dragConstraints={constraints} // Sử dụng state constraints linh hoạt
          onPointerDown={handlePointerDown}
          onPointerUp={handlePointerUp}
          onDrag={handleDrag}
          onDragEnd={handleDragEnd}
          initial={false} // 🟢 SỬA LỖI: Ngăn hiệu ứng animation ban đầu
          animate={{ x: pos.x, y: pos.y }}
          transition={{ type: "spring", stiffness: 500, damping: 35 }}
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            zIndex: 50,
            cursor: "grab",
          }}
          className="select-none"
        >
          <Button
            className={cn(
              "border",
              "select-none",
              "shadow-lg transition-all duration-300 h-auto",
              {
                "rounded-l-lg rounded-r-none px-4 py-3 flex items-center":
                  snapEdge === "right",
                "rounded-r-lg rounded-l-none px-4 py-3 flex items-center":
                  snapEdge === "left",
                "rounded-full w-14 h-14 p-0 justify-center":
                  snapEdge === "none",
              }
            )}
            onClickCapture={(e) => e.stopPropagation()}
          >
            <div
              className={cn(
                {
                  "mr-2 w-5 h-auto": snapEdge !== "none",
                  "w-6 h-6": snapEdge === "none",
                },
                "relative"
              )}
            >
              <img
                src="/LogoWebWhite.png"
                alt="Chat AI"
                className="w-full h-full logo-light"
              />
            </div>
            {snapEdge !== "none" && t("results.chatWithAI.title")}
          </Button>
        </motion.div>
      )}

      {/* Chat panel */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            style={{ position: "fixed", top: 0, left: 0, zIndex: 50 }}
            initial={{ ...getPanelPosition(), opacity: 0, scale: 0.95 }}
            animate={{ ...getPanelPosition(), opacity: 1, scale: 1 }}
            transition={{ duration: 0.15, ease: "easeOut" }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="origin-top-left"
          >
            <Card className="w-full max-w-sm shadow-2xl border-2 border-chart-2 cursor-default">
              <CardHeader className="flex flex-row items-center justify-between p-4 border-b">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <div className="relative w-5 h-auto">
                    <img
                      src="/LogoWebWhite.png"
                      alt="Chat AI"
                      className="w-full h-full logo-light"
                    />
                  </div>
                  {t("results.chatWithAI.title")}
                </CardTitle>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => setIsOpen(false)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </CardHeader>
              <CardContent>
                <ScrollArea
                  className="h-[300px] w-full pr-4"
                  ref={scrollAreaRef}
                >
                  <div className="space-y-4">
                    {messages.length === 0 && (
                      <div className="text-center text-muted-foreground p-4 text-sm">
                        {t("results.chatWithAI.intro", { breedName })}
                      </div>
                    )}
                    {messages.map((message, index) => (
                      <div
                        key={index}
                        className={cn(
                          "flex gap-3 text-sm",
                          message.role === "user"
                            ? "justify-end"
                            : "justify-start"
                        )}
                      >
                        {message.role === "model" && (
                          <Avatar className="h-8 w-8 bg-white dark:bg-transparent">
                            <AvatarImage
                              src="/LogoWebWhite.png"
                              alt="AI"
                              className="logo-light"
                            />
                          </Avatar>
                        )}
                        <div
                          className={cn(
                            "rounded-lg px-3 py-2 max-w-[80%]",
                            message.role === "user"
                              ? "bg-primary text-primary-foreground"
                              : "bg-muted"
                          )}
                        >
                          <SimpleMarkdownRenderer text={message.content} />
                        </div>
                        {message.role === "user" && (
                          <Avatar className="h-8 w-8">
                            {user?.avatarUrl && (
                              <AvatarImage
                                src={user.avatarUrl}
                                alt={user.username}
                              />
                            )}
                            <AvatarFallback>
                              {user?.username ? (
                                user.username.charAt(0).toUpperCase()
                              ) : (
                                <User className="h-5 w-5" />
                              )}
                            </AvatarFallback>
                          </Avatar>
                        )}
                      </div>
                    ))}
                    {isLoading && (
                      <div className="flex justify-start gap-3 text-sm">
                        <Avatar className="h-8 w-8">
                          <AvatarFallback>AI</AvatarFallback>
                        </Avatar>
                        <div className="rounded-lg px-3 py-2 bg-muted flex items-center">
                          <div className="flex items-center space-x-1.5 h-5">
                            <div className="h-2 w-2 bg-muted-foreground rounded-full animate-bounce [animation-delay:-0.3s]"></div>
                            <div className="h-2 w-2 bg-muted-foreground rounded-full animate-bounce [animation-delay:-0.15s]"></div>
                            <div className="h-2 w-2 bg-muted-foreground rounded-full animate-bounce"></div>
                          </div>
                        </div>
                      </div>
                    )}
                    {/* 🟢 SỬA LOGIC: ẨN GỢI Ý NGAY KHI ĐANG LOADING */}
                    {messages.length <= 1 && !isLoading && (
                      <div className="pt-4 border-t">
                        <p className="text-xs text-muted-foreground mb-2 flex items-center gap-1.5 justify-center">
                          <Sparkles className="w-3 h-3" /> Gợi ý cho bạn:
                        </p>
                        <div className="grid grid-cols-2 gap-2">
                          {samplePrompts.map((prompt, i) => (
                            <Button
                              key={i}
                              variant="outline"
                              size="sm"
                              className="text-xs h-auto py-1.5 whitespace-normal text-left justify-start"
                              onClick={() => submitMessage(prompt)}
                            >
                              {prompt}
                            </Button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </ScrollArea>
              </CardContent>
              <CardFooter className="flex-col items-start gap-2">
                <form
                  onSubmit={handleFormSubmit}
                  className="w-full flex items-center gap-2"
                >
                  <Input
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder={t("results.chatWithAI.placeholder", {
                      breedName,
                    })}
                    disabled={isLoading || remainingTokens <= 0}
                    className="h-9"
                  />
                  <Button
                    type="submit"
                    size="icon"
                    className="h-9 w-9"
                    disabled={isLoading || remainingTokens <= 0}
                  >
                    <Send className="h-4 w-4" />
                  </Button>
                </form>
                <div className="text-xs text-muted-foreground w-full text-center">
                  {remainingTokens > 0
                    ? t("results.chatWithAI.remaining", {
                        count: remainingTokens,
                      })
                    : t("results.chatWithAI.limitReached")}
                </div>
              </CardFooter>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
