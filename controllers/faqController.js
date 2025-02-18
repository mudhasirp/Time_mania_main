

const faqData = [
    {
      question: "What is your return policy for watches?",
      answer: "Time Mania accepts returns within 7 days of purchase, provided you have a valid receipt and the watch is in its original condition."
    },
    {
      question: "How do I track my watch order?",
      answer: "After placing your order, you'll receive a tracking link via email. You can also log in to your Time Mania account and view your order status."
    },
    {
      question: "Which payment methods are accepted?",
      answer: "We accept all major credit cards,RazorPay, and bank transfers for watch purchases."
    },
    {
      question: "Do you ship watches internationally?",
      answer: "Yes, Time Mania ships worldwide. Shipping costs vary by region and will be calculated at checkout."
    },
    {
      question: "Are the watches sold by Time Mania genuine or replicas?",
      answer: "All watches sold at Time Mania are 100% authentic. We source them directly from authorized distributors and manufacturers."
    },
    {
      question: "Is there a warranty for the watches purchased from Time Mania?",
      answer: "Yes, most of our watches come with a manufacturer’s warranty (usually 1 year). The specific warranty details are provided on each product page."
    },
    {
      question: "Can I replace the watch strap or get it adjusted?",
      answer: "Absolutely! We offer strap replacements and adjustments. Contact our support or visit a partner service center for assistance."
    }
  ];
  
  
  const getFaqPage = (req, res) => {
    res.render("faq", { faqs: faqData });
  };
  
  module.exports = { getFaqPage };
  