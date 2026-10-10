import React, { useState } from 'react';
import { 
  ShoppingBag, 
  Search, 
  ArrowLeft, 
  Star, 
  Sparkles, 
  Check, 
  ShoppingCart,
  Plus,
  Send,
  Bot
} from 'lucide-react';

export default function ShoppingPageView({ onBackToAdmin, onTriggerToast }) {
  const [cart, setCart] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const [messages, setMessages] = useState([
    { sender: 'bot', text: 'Hello! I am your NovaMart AI shopping assistant. Ask me about product availability, organic alternatives, or bundle discounts!' }
  ]);

  const products = [
    {
      id: 1,
      name: 'Aerofit Wireless Smart Earbuds',
      price: 79.99,
      category: 'Electronics',
      badge: 'Bestseller',
      image: 'https://images.unsplash.com/photo-1590658268037-6bf12165a8df?w=350&auto=format&fit=crop&q=80',
      rating: 4.8
    },
    {
      id: 2,
      name: 'Organic Fair-Trade Cold Brew (12pk)',
      price: 34.50,
      category: 'Beverages',
      badge: 'Popular',
      image: 'https://images.unsplash.com/photo-1517701604599-bb29b565090c?w=350&auto=format&fit=crop&q=80',
      rating: 4.9
    },
    {
      id: 3,
      name: 'Artisan Sourdough Bakery Loaf',
      price: 6.50,
      category: 'Bakery',
      badge: 'Fresh Daily',
      image: 'https://images.unsplash.com/photo-1586444248902-2f64eddc13df?w=350&auto=format&fit=crop&q=80',
      rating: 4.7
    },
    {
      id: 4,
      name: 'EcoClean Plant-Based Detergent (2L)',
      price: 18.99,
      category: 'Eco Household',
      badge: 'Eco-Friendly',
      image: 'https://images.unsplash.com/photo-1610557892470-55d9e80c0bce?w=350&auto=format&fit=crop&q=80',
      rating: 4.6
    }
  ];

  const addToCart = (product) => {
    setCart(prev => [...prev, product]);
    if (onTriggerToast) {
      onTriggerToast(`Added "${product.name}" to cart ($${product.price})`);
    }
  };

  const handleSendMessage = (e) => {
    e.preventDefault();
    if (!chatInput.trim()) return;

    const userText = chatInput;
    setMessages(prev => [...prev, { sender: 'user', text: userText }]);
    setChatInput('');

    setTimeout(() => {
      let reply = "We have that in stock at Store #104 Austin Flagship! It is eligible for 2-hour doorstep delivery.";
      if (userText.toLowerCase().includes('coffee') || userText.toLowerCase().includes('brew')) {
        reply = "Our Organic Fair-Trade Cold Brew (12pk) is currently trending with 14 units left in stock today. Would you like me to reserve one?";
      } else if (userText.toLowerCase().includes('discount') || userText.toLowerCase().includes('deal')) {
        reply = "Bundle discount active: Save 15% when ordering Cold Brew with Artisan Sourdough Bakery Loaf!";
      }
      setMessages(prev => [...prev, { sender: 'bot', text: reply }]);
    }, 600);
  };

  return (
    <div className="storefront-container">
      {/* Persona Header */}
      <div className="persona-banner">
        <div className="flex-row items-center gap-3">
          <button 
            type="button" 
            className="back-to-admin-btn"
            onClick={onBackToAdmin}
          >
            <ArrowLeft size={16} />
            <span>Return to Admin View</span>
          </button>
          <div className="persona-tag">Persona: Customer Shopping Storefront</div>
        </div>

        <div className="cart-indicator-badge">
          <ShoppingCart size={16} />
          <span>Cart: <strong>{cart.length} items</strong> (${cart.reduce((s, c) => s + c.price, 0).toFixed(2)})</span>
        </div>
      </div>

      {/* Hero Storefront Banner */}
      <div className="storefront-hero">
        <div className="hero-content">
          <div className="hero-pill">
            <Sparkles size={14} />
            <span>AI-Optimized Fresh Omnichannel Retail</span>
          </div>
          <h2 className="hero-title">Shop Fresh Groceries & Smart Tech</h2>
          <p className="hero-subtitle">Real-time local inventory direct from Austin Flagship Store #104</p>
        </div>
      </div>

      {/* Grid of Storefront Products */}
      <div className="storefront-product-grid">
        {products.map((prod) => (
          <div key={prod.id} className="storefront-card">
            <div className="product-img-wrap">
              <img src={prod.image} alt={prod.name} className="product-cover-img" />
              <span className="prod-badge-chip">{prod.badge}</span>
            </div>
            <div className="product-details">
              <div className="prod-cat-row">
                <span className="prod-category">{prod.category}</span>
                <span className="prod-rating">★ {prod.rating}</span>
              </div>
              <h4 className="prod-name">{prod.name}</h4>
              <div className="prod-bottom-row">
                <span className="prod-price">${prod.price.toFixed(2)}</span>
                <button
                  type="button"
                  className="add-to-cart-btn"
                  onClick={() => addToCart(prod)}
                >
                  <Plus size={15} /> Add
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* RAG-Powered AI Shopper Chatbot Widget */}
      <div className="ai-shopper-widget">
        <div className="widget-header">
          <div className="flex-row items-center gap-2">
            <Bot size={18} className="text-primary" />
            <span className="widget-title">NovaMart AI Shopping Copilot</span>
          </div>
          <span className="status-dot-green"></span>
        </div>
        <div className="chat-messages-container">
          {messages.map((m, idx) => (
            <div key={idx} className={`chat-bubble ${m.sender}`}>
              {m.text}
            </div>
          ))}
        </div>
        <form onSubmit={handleSendMessage} className="chat-input-row">
          <input
            type="text"
            className="chat-text-input"
            placeholder="Ask about ingredients, inventory, or discounts..."
            value={chatInput}
            onChange={(e) => setChatInput(e.target.value)}
          />
          <button type="submit" className="chat-send-btn">
            <Send size={15} />
          </button>
        </form>
      </div>
    </div>
  );
}
