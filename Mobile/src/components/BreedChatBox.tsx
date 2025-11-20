import React, { useState, useRef, useEffect, useMemo } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  StyleSheet,
  Animated,
  PanResponder,
  Dimensions,
  Image,
  Modal,
  Pressable,
} from "react-native";
import { useI18n } from "../lib/i18n-context";
import { useAuth } from "../lib/auth-context";
import { apiClient } from "../lib/api-client";
import { SafeAreaView } from "react-native-safe-area-context";

interface Message {
  role: "user" | "model";
  content: string;
}

interface BreedChatBoxProps {
  breedSlug: string;
  breedName: string;
  initialMessage?: string;
}

const SimpleMarkdownRenderer = ({ text }: { text: string }) => {
  const lines = text.split("\n");

  return (
    <View style={styles.markdownContainer}>
      {lines.map((line, i) => {
        if (line.startsWith("### ")) {
          return (
            <Text key={i} style={styles.h3}>
              {line.substring(4)}
            </Text>
          );
        }
        if (line.startsWith("## ")) {
          return (
            <Text key={i} style={styles.h2}>
              {line.substring(3)}
            </Text>
          );
        }
        if (line.startsWith("# ")) {
          return (
            <Text key={i} style={styles.h1}>
              {line.substring(2)}
            </Text>
          );
        }

        // Handle bold text
        const parts = line.split(/(\*\*.*?\*\*)/g);
        return (
          <Text key={i} style={styles.paragraph}>
            {parts.map((part, j) =>
              part.startsWith("**") && part.endsWith("**") ? (
                <Text key={j} style={styles.bold}>
                  {part.slice(2, -2)}
                </Text>
              ) : (
                part
              )
            )}
          </Text>
        );
      })}
    </View>
  );
};

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
  const [remainingTokens, setRemainingTokens] = useState(user?.remainingTokens ?? 0);

  const pan = useRef(new Animated.ValueXY({ x: 0, y: 96 })).current;
  const lastTap = useRef<number>(0);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (event, gestureState) => {
        return Math.abs(gestureState.dx) > 10 || Math.abs(gestureState.dy) > 10;
      },
      onPanResponderMove: Animated.event(
        [null, { dx: pan.x, dy: pan.y }],
        { useNativeDriver: false }
      ),
      onPanResponderRelease: (event, gestureState) => {
        const screenWidth = Dimensions.get("window").width;
        const screenHeight = Dimensions.get("window").height;
        const snapThreshold = 120;
        const buttonWidth = 56;
        const buttonHeight = 56;

        let finalX = gestureState.moveX;
        let finalY = gestureState.moveY;

        // Snap to edges
        if (gestureState.moveX < snapThreshold) {
          finalX = 0;
        } else if (gestureState.moveX > screenWidth - buttonWidth - snapThreshold) {
          finalX = screenWidth - buttonWidth;
        }

        // Constrain Y position
        finalY = Math.max(0, Math.min(finalY, screenHeight - buttonHeight));

        Animated.spring(pan, {
          toValue: { x: finalX, y: finalY },
          useNativeDriver: false,
        }).start();
      },
    })
  ).current;

  const remainingTokensDisplay = user?.remainingTokens ?? 0;

  // LOAD CHAT HISTORY
  useEffect(() => {
    const fetchHistory = async () => {
      try {
        setIsLoading(true);
        const { history } = await apiClient.getChatHistory(breedSlug);
        const formattedMessages: Message[] = history.map((item:any) => ({
          role: item.role,
          content: item.parts[0].text,
        }));
        if (formattedMessages.length > 0) {
          setMessages(formattedMessages);
        }
      } catch (error) {
        console.error("Could not load chat history:", error);
      } finally {
        setIsLoading(false);
      }
    };

    if (isOpen) {
      fetchHistory();
    }
  }, [isOpen, breedSlug]);

  const samplePrompts = useMemo(
    () => [
      t("results.chatWithAI.prompts.funFact"),
      t("results.chatWithAI.prompts.diet", { breedName }),
      t("results.chatWithAI.prompts.activities"),
      t("results.chatWithAI.prompts.apartment"),
    ],
    [t, breedName]
  );

  const submitMessage = async (messageContent: string) => {
    if (
      !messageContent.trim() ||
      isLoading ||
      remainingTokensDisplay <= 0
    ) {
      return;
    }

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
      if (isAuthenticated) {
        await refetchUser();
      }
      setMessages((prev) => [...prev, { role: "model", content: reply }]);
    } catch (error) {
      console.error("Failed to get response from AI:", error);
      setInput(messageContent);
      setMessages((prev) => prev.slice(0, -1));
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = () => {
    submitMessage(input);
  };

  useEffect(() => {
    console.log("[v0] isOpen state changed:", isOpen);
  }, [isOpen]);

  console.log("[v0] render - isOpen:", isOpen);

  return (
    <>
      {/* FLOATING BUTTON */}
      {!isOpen && (
        <Animated.View
          style={[
            styles.floatingButton,
            {
              transform: [
                { translateX: pan.x },
                { translateY: pan.y },
              ],
            },
          ]}
          {...panResponder.panHandlers}
        >
          <Pressable
            style={styles.buttonContent}
            onPress={() => {
              console.log("[v0] Button pressed, opening modal");
              setIsOpen(true);
            }}
          >
            <Image
              source={require("../assets/LogoWebWhite.png")}
              style={styles.buttonIcon}
            />
            <Text style={styles.buttonText}>{t("results.chatWithAI.title")}</Text>
          </Pressable>
        </Animated.View>
      )}

      {/* CHAT MODAL */}
      <Modal
        visible={isOpen}
        transparent
        animationType="fade"
        onRequestClose={() => {
          console.log("[v0] Modal closed request");
          setIsOpen(false);
        }}
      >
        <View style={styles.modalOverlay}>
          <SafeAreaView style={styles.chatContainer}>
            {/* HEADER */}
            <View style={styles.header}>
              <View style={styles.headerTitle}>
                <Image
                  source={require("../assets/LogoWebWhite.png")}
                  style={styles.headerIcon}
                />
                <Text style={styles.headerText}>
                  {t("results.chatWithAI.title")}
                </Text>
              </View>
              <TouchableOpacity onPress={() => setIsOpen(false)}>
                <Text style={styles.closeButton}>✕</Text>
              </TouchableOpacity>
            </View>

            {/* MESSAGES AREA */}
            <ScrollView
              style={styles.messagesContainer}
              contentContainerStyle={styles.messagesContent}
              showsVerticalScrollIndicator={false}
            >
              {messages.length === 0 && (
                <View style={styles.emptyState}>
                  <Text style={styles.emptyStateText}>
                    {t("results.chatWithAI.intro", { breedName })}
                  </Text>
                </View>
              )}

              {messages.map((message, index) => (
                <View
                  key={index}
                  style={[
                    styles.messageWrapper,
                    message.role === "user"
                      ? styles.userMessageWrapper
                      : styles.aiMessageWrapper,
                  ]}
                >
                  {message.role === "model" && (
                    <Image
                      source={require("../assets/LogoWebWhite.png")}
                      style={styles.avatar}
                    />
                  )}
                  <View
                    style={[
                      styles.messageBubble,
                      message.role === "user"
                        ? styles.userBubble
                        : styles.aiBubble,
                    ]}
                  >
                    <SimpleMarkdownRenderer text={message.content} />
                  </View>
                  {message.role === "user" && (
                    <View style={styles.userAvatar}>
                      {user?.avatarUrl ? (
                        <Image
                          source={{ uri: user.avatarUrl }}
                          style={styles.avatar}
                        />
                      ) : (
                        <Text style={styles.avatarInitial}>
                          {user?.username
                            ? user.username.charAt(0).toUpperCase()
                            : "U"}
                        </Text>
                      )}
                    </View>
                  )}
                </View>
              ))}

              {isLoading && (
                <View style={[styles.messageWrapper, styles.aiMessageWrapper]}>
                  <Image
                    source={require("../assets/LogoWebWhite.png")}
                    style={styles.avatar}
                  />
                  <View style={[styles.messageBubble, styles.aiBubble]}>
                    <ActivityIndicator size="small" color="#666" />
                  </View>
                </View>
              )}

              {/* SAMPLE PROMPTS */}
              {messages.length <= 1 && !isLoading && (
                <View style={styles.suggestionsContainer}>
                  <Text style={styles.suggestionsTitle}>✨ Gợi ý cho bạn:</Text>
                  <View style={styles.suggestionsGrid}>
                    {samplePrompts.map((prompt, i) => (
                      <TouchableOpacity
                        key={i}
                        style={styles.suggestionButton}
                        onPress={() => submitMessage(prompt)}
                      >
                        <Text style={styles.suggestionText}>{prompt}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              )}
            </ScrollView>

            {/* INPUT AREA */}
            <View style={styles.inputContainer}>
              <View style={styles.inputRow}>
                <TextInput
                  style={styles.input}
                  placeholder={t("results.chatWithAI.placeholder", {
                    breedName,
                  })}
                  placeholderTextColor="#999"
                  value={input}
                  onChangeText={setInput}
                  editable={!isLoading && remainingTokensDisplay > 0}
                  multiline
                  maxLength={500}
                />
                <TouchableOpacity
                  style={[
                    styles.sendButton,
                    (isLoading || remainingTokensDisplay <= 0) &&
                      styles.sendButtonDisabled,
                  ]}
                  onPress={handleSubmit}
                  disabled={isLoading || remainingTokensDisplay <= 0}
                >
                  <Text style={styles.sendButtonText}>→</Text>
                </TouchableOpacity>
              </View>
              <Text style={styles.tokenInfo}>
                {remainingTokensDisplay > 0
                  ? t("results.chatWithAI.remaining", {
                      count: remainingTokensDisplay,
                    })
                  : t("results.chatWithAI.limitReached")}
              </Text>
            </View>
          </SafeAreaView>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  floatingButton: {
    position: "absolute",
    zIndex: 50,
  },
  buttonContent: {
    backgroundColor: "#2563eb",
    borderRadius: 28,
    width: 56,
    height: 56,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  buttonIcon: {
    width: 24,
    height: 24,
    resizeMode: "contain",
  },
  buttonText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "600",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
  },
  chatContainer: {
    backgroundColor: "#fff",
    borderRadius: 16,
    flex: 1,
    overflow: "hidden",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
  },
  headerTitle: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  headerIcon: {
    width: 20,
    height: 20,
    resizeMode: "contain",
  },
  headerText: {
    fontSize: 18,
    fontWeight: "600",
    color: "#1f2937",
  },
  closeButton: {
    fontSize: 24,
    color: "#666",
    fontWeight: "600",
  },
  messagesContainer: {
    flex: 1,
    paddingHorizontal: 16,
  },
  messagesContent: {
    paddingVertical: 12,
    gap: 16,
  },
  emptyState: {
    alignItems: "center",
    paddingVertical: 20,
  },
  emptyStateText: {
    fontSize: 14,
    color: "#999",
    textAlign: "center",
  },
  messageWrapper: {
    flexDirection: "row",
    marginBottom: 8,
    gap: 8,
  },
  userMessageWrapper: {
    justifyContent: "flex-end",
  },
  aiMessageWrapper: {
    justifyContent: "flex-start",
  },
  messageBubble: {
    maxWidth: "80%",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  userBubble: {
    backgroundColor: "#2563eb",
    borderRadius: 12,
  },
  aiBubble: {
    backgroundColor: "#f3f4f6",
  },
  userMessageText: {
    color: "#fff",
    fontSize: 14,
  },
  aiMessageText: {
    color: "#1f2937",
    fontSize: 14,
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    resizeMode: "cover",
  },
  userAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#dbeafe",
    justifyContent: "center",
    alignItems: "center",
  },
  avatarInitial: {
    fontSize: 14,
    fontWeight: "600",
    color: "#2563eb",
  },
  markdownContainer: {
    gap: 8,
  },
  h1: {
    fontSize: 18,
    fontWeight: "800",
    marginVertical: 8,
  },
  h2: {
    fontSize: 16,
    fontWeight: "700",
    marginVertical: 8,
  },
  h3: {
    fontSize: 14,
    fontWeight: "600",
    marginVertical: 8,
  },
  paragraph: {
    fontSize: 14,
    lineHeight: 20,
    color: "#1f2937",
  },
  bold: {
    fontWeight: "700",
  },
  suggestionsContainer: {
    borderTopWidth: 1,
    borderTopColor: "#e5e7eb",
    paddingTop: 12,
  },
  suggestionsTitle: {
    fontSize: 12,
    color: "#666",
    marginBottom: 8,
    textAlign: "center",
    fontWeight: "600",
  },
  suggestionsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  suggestionButton: {
    flex: 1,
    minWidth: "45%",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 6,
    backgroundColor: "#f9fafb",
  },
  suggestionText: {
    fontSize: 12,
    color: "#374151",
    fontWeight: "500",
    textAlign: "center",
  },
  inputContainer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: "#e5e7eb",
  },
  inputRow: {
    flexDirection: "row",
    gap: 8,
    alignItems: "flex-end",
    marginBottom: 8,
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 14,
    color: "#1f2937",
    maxHeight: 60,
  },
  sendButton: {
    backgroundColor: "#2563eb",
    borderRadius: 6,
    width: 36,
    height: 36,
    justifyContent: "center",
    alignItems: "center",
  },
  sendButtonDisabled: {
    backgroundColor: "#d1d5db",
    opacity: 0.5,
  },
  sendButtonText: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "600",
  },
  tokenInfo: {
    fontSize: 12,
    color: "#999",
    textAlign: "center",
  },
});
