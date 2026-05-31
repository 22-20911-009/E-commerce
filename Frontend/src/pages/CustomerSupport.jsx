import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Bot, Sparkles } from "lucide-react";
import storeData from "../data/shopmart.json";

// ─── Tool Definitions (sent to LLM so it can decide what to call) ────────────

const TOOLS = [
    {
        type: "function",
        function: {
            name: "get_offers",
            description: "Get current sales, promotions and discount codes",
            parameters: { type: "object", properties: {} },
        },
    },
    {
        type: "function",
        function: {
            name: "get_categories",
            description: "Get available product categories",
            parameters: { type: "object", properties: {} },
        },
    },
    {
        type: "function",
        function: {
            name: "get_product_info",
            description: "Get details for a product category: types, sizes, price, materials",
            parameters: {
                type: "object",
                properties: {
                    category: {
                        type: "string",
                        enum: ["jeans", "bags", "glasses", "tshirts", "shoes", "jackets", "suits"],
                    },
                },
                required: ["category"],
            },
        },
    },
    {
        type: "function",
        function: {
            name: "get_policy",
            description: "Get store policy for returns, shipping, payments, or cancellation",
            parameters: {
                type: "object",
                properties: {
                    type: {
                        type: "string",
                        enum: ["returns", "shipping", "payments", "cancellation"],
                    },
                },
                required: ["type"],
            },
        },
    },
    {
        type: "function",
        function: {
            name: "get_order_tracking",
            description: "Get order tracking info and status meanings",
            parameters: { type: "object", properties: {} },
        },
    },
    {
        type: "function",
        function: {
            name: "get_seller_info",
            description: "Get seller registration, commission and payout info",
            parameters: { type: "object", properties: {} },
        },
    },
    {
        type: "function",
        function: {
            name: "get_faq",
            description: "Get FAQs. Use as fallback when no other tool fits",
            parameters: { type: "object", properties: {} },
        },
    },
    {
        type: "function",
        function: {
            name: "get_store_contact",
            description: "Get owner name, phone, email and working hours",
            parameters: { type: "object", properties: {} },
        },
    },
];

// ─── Tool Executor (runs the tool the LLM requested) ─────────────────────────

const executeTool = (name, args) => {
    switch (name) {
        case "get_offers":
            return JSON.stringify(storeData.currentOffers);
        case "get_categories":
            return JSON.stringify({
                availableCategories: ["Jeans", "Bags", "Glasses", "T-Shirts", "Shoes", "Jackets", "Suits"],
                note: "ShopMart specialises in fashion clothing and accessories across these 7 categories.",
            });
        case "get_product_info":
            return JSON.stringify(storeData.productInfo[args.category] ?? "Category not found");
        case "get_policy": {
            const policyKey = args.type === "payment" ? "payments" : args.type;
            return JSON.stringify(storeData.policies[policyKey] ?? "Policy not found");
        }
        case "get_order_tracking":
            return JSON.stringify(storeData.orderTracking);
        case "get_seller_info":
            return JSON.stringify(storeData.sellerProgram);
        case "get_faq":
            return JSON.stringify(storeData.faq);
        case "get_store_contact":
            return JSON.stringify(storeData.store.contact);
        default:
            return "Tool not found";
    }
};

// ─── Constants ────────────────────────────────────────────────────────────────

const { supportAgent, phone, email, workingHours } = storeData.store.contact;

const SYSTEM_PROMPT =
    `You are ShopBot for ShopMart. ShopMart sells ONLY: Jeans, Bags, Glasses, T-Shirts, Shoes, Jackets, Suits. ` +
    `RULES: 1) Always call a tool first — NEVER answer from memory or training data. ` +
    `2) Use ONLY the exact data returned by the tool. Never add, change or invent any detail. ` +
    `3) Never show tool names, JSON, or XML tags in your response — speak naturally. ` +
    `4) For unknown products say we don't carry it. ` +
    `Owner: ${supportAgent} | Phone: ${phone} | Email: ${email} | Hours: ${workingHours}.`;

const BANNED_WORDS = ["sex", "politics", "violence", "religion"];

const QUESTIONS = [
    "What is the best sale offer on ShopMart today?",
    "How can I start selling on ShopMart?",
    "What are the popular things on ShopMart?",
    "What payment methods does ShopMart accept?",
];

// ─── Component ────────────────────────────────────────────────────────────────

const CustomerSupport = () => {
    const [response, setResponse] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [query, setQuery] = useState("");

    const handleSubmit = async (userQuery) => {
        const trimmed = userQuery.trim();
        if (!trimmed || isLoading) return;

        if (BANNED_WORDS.some((w) => trimmed.toLowerCase().includes(w))) {
            setResponse("I'm only able to help with questions about our store, products, and services.");
            return;
        }

        setResponse("");
        setIsLoading(true);

        const apiKey = import.meta.env.VITE_GROQ_API_KEY;
        if (!apiKey) {
            setResponse("Error: API key is not configured.");
            setIsLoading(false);
            return;
        }

        try {
            const messages = [
                { role: "system", content: SYSTEM_PROMPT },
                { role: "user", content: trimmed },
            ];

            // ── Pass 1: LLM decides which tools to call ──────────────────────
            const res1 = await fetch("https://api.groq.com/openai/v1/chat/completions", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${apiKey}`,
                },
                body: JSON.stringify({
                    model: "llama-3.1-8b-instant",
                    messages,
                    tools: TOOLS,
                    tool_choice: "auto",
                }),
            });

            const data1 = await res1.json();
            if (!res1.ok) {
                const errMsg = data1?.error?.message || res1.statusText;
                if (errMsg.toLowerCase().includes("failed") || errMsg.toLowerCase().includes("function")) {
                    const faqResult = executeTool("get_faq", {});
                    const fallbackRes = await fetch("https://api.groq.com/openai/v1/chat/completions", {
                        method: "POST",
                        headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
                        body: JSON.stringify({
                            model: "llama-3.1-8b-instant",
                            max_tokens: 400,
                            messages: [
                                ...messages,
                                { role: "assistant", content: null, tool_calls: [{ id: "fallback_faq", type: "function", function: { name: "get_faq", arguments: "{}" } }] },
                                { role: "tool", tool_call_id: "fallback_faq", content: faqResult },
                            ],
                        }),
                    });
                    const fallbackData = await fallbackRes.json();
                    setResponse(fallbackData?.choices?.[0]?.message?.content || "Sorry, I could not process your request. Please try again.");
                    return;
                }
                setResponse(`Error: ${errMsg}`);
                return;
            }

            let assistantMsg = data1.choices[0].message;

            // No tool calls — return direct content, or force get_faq as fallback
            if (!assistantMsg.tool_calls || assistantMsg.tool_calls.length === 0) {
                if (assistantMsg.content) {
                    setResponse(assistantMsg.content);
                    return;
                }
                // LLM returned nothing — inject get_faq as fallback
                assistantMsg = {
                    role: "assistant",
                    content: null,
                    tool_calls: [{ id: "fallback_faq", type: "function", function: { name: "get_faq", arguments: "{}" } }],
                };
            }

            // ── Execute each tool the LLM requested ──────────────────────────
            const toolResults = assistantMsg.tool_calls.map((tc) => {
                const args = JSON.parse(tc.function.arguments || "{}");
                return {
                    role: "tool",
                    tool_call_id: tc.id,
                    content: executeTool(tc.function.name, args),
                };
            });

            // ── Pass 2: LLM generates final answer using tool results ─────────
            const res2 = await fetch("https://api.groq.com/openai/v1/chat/completions", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${apiKey}`,
                },
                body: JSON.stringify({
                    model: "llama-3.1-8b-instant",
                    max_tokens: 400,
                    messages: [...messages, assistantMsg, ...toolResults],
                }),
            });

            const data2 = await res2.json();
            if (!res2.ok) {
                setResponse(`Error: ${data2?.error?.message || res2.statusText}`);
                return;
            }

            setResponse(data2.choices[0].message.content);
        } catch (err) {
            setResponse(`Network error: ${err.message}. Check your connection and try again.`);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        const onKeyPress = (e) => {
            if (e.key === "Enter" && query.trim() && e.target.tagName !== "INPUT") {
                handleSubmit(query);
            }
        };
        document.addEventListener("keypress", onKeyPress);
        return () => document.removeEventListener("keypress", onKeyPress);
    }, [query]);

    return (
        <div className="min-h-screen text-gray-300 flex flex-col">
            <motion.div
                initial={{ opacity: 0, y: -30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
                className="py-10 text-center"
            >
                <div className="flex items-center justify-center gap-3 mb-2">
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-emerald-400 to-teal-600 flex items-center justify-center shadow-lg">
                        <Bot className="w-6 h-6 text-white" />
                    </div>
                    <h1 className="text-4xl md:text-5xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-teal-600">
                        Customer Support
                    </h1>
                </div>
                <p className="text-gray-500 text-sm flex items-center justify-center gap-1.5 mt-1">
                    <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
                    Powered by Groq AI · ShopBot
                </p>
            </motion.div>

            <main className="flex-grow container mx-auto px-4 pb-12 max-w-4xl">
                <motion.form
                    initial={{ opacity: 0, y: 30 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, delay: 0.2 }}
                    onSubmit={(e) => { e.preventDefault(); handleSubmit(query); }}
                    className="mb-8"
                >
                    <div className="flex shadow-lg rounded-xl overflow-hidden ring-1 ring-gray-700 focus-within:ring-2 focus-within:ring-emerald-500 transition-all duration-300">
                        <input
                            type="text"
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            maxLength={200}
                            placeholder="Ask about products, orders, delivery, or offers..."
                            className="flex-grow px-6 py-4 bg-gray-800 text-gray-200 placeholder-gray-500 focus:outline-none text-base"
                        />
                        <button
                            type="submit"
                            disabled={isLoading || !query.trim()}
                            className="px-8 py-4 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-semibold transition-all duration-300 focus:outline-none disabled:opacity-50 text-base min-w-[90px] flex items-center justify-center"
                        >
                            {isLoading ? (
                                <span className="inline-block animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-white" />
                            ) : (
                                "Ask"
                            )}
                        </button>
                    </div>
                    <p className="text-right text-xs text-gray-600 mt-1 pr-1">{query.length}/200</p>
                </motion.form>

                <motion.div
                    initial={{ opacity: 0, y: 30 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, delay: 0.35 }}
                    className="mb-8"
                >
                    <h2 className="text-xl font-semibold mb-4 text-emerald-400">Common Questions</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {QUESTIONS.map((q, i) => (
                            <motion.button
                                key={i}
                                whileHover={{ scale: 1.02 }}
                                whileTap={{ scale: 0.98 }}
                                onClick={() => { setQuery(q); handleSubmit(q); }}
                                className="text-left px-5 py-4 bg-gray-800 border border-gray-700 hover:border-emerald-500/60 rounded-xl transition-all duration-200 focus:outline-none focus:ring-1 focus:ring-emerald-500 shadow-md text-sm text-gray-300 hover:text-white"
                            >
                                <span className="text-emerald-400 mr-2 font-bold">→</span>
                                {q}
                            </motion.button>
                        ))}
                    </div>
                </motion.div>

                <motion.div
                    initial={{ opacity: 0, y: 30 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, delay: 0.5 }}
                    className="rounded-xl border border-gray-700 bg-gray-800 shadow-xl overflow-hidden"
                >
                    <div className="flex items-center gap-2 px-5 py-3 border-b border-gray-700">
                        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                        <span className="text-xs text-gray-400 font-medium tracking-wide">ShopBot Response</span>
                    </div>
                    <div className="p-6 min-h-[200px] flex items-center">
                        <AnimatePresence mode="wait">
                            {isLoading ? (
                                <motion.div
                                    key="loading"
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    exit={{ opacity: 0 }}
                                    className="w-full flex flex-col items-center justify-center gap-3"
                                >
                                    <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-emerald-500" />
                                    <p className="text-sm text-gray-500">ShopBot is thinking...</p>
                                </motion.div>
                            ) : response ? (
                                <motion.div
                                    key="response"
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0 }}
                                    className="w-full"
                                >
                                    <p className="text-gray-200 text-base leading-relaxed whitespace-pre-wrap">
                                        {response}
                                    </p>
                                </motion.div>
                            ) : (
                                <motion.p
                                    key="placeholder"
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    exit={{ opacity: 0 }}
                                    className="text-gray-500 italic text-base text-center w-full"
                                >
                                    Your response will appear here...
                                </motion.p>
                            )}
                        </AnimatePresence>
                    </div>
                </motion.div>
            </main>

            <motion.footer
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.5, delay: 0.6 }}
                className="text-center py-4 text-gray-600 text-xs"
            >
                © 2024 ShopMart Customer Support · Powered by Groq AI
            </motion.footer>
        </div>
    );
};

export default CustomerSupport;
