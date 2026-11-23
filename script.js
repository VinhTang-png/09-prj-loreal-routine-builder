/* Get references to the page elements */
const selectedProductsList = document.getElementById("selectedProductsList");
const clearSelectedProductsButton = document.getElementById("clearSelectedProducts");
const categoryFilter = document.getElementById("categoryFilter");
const productsContainer = document.getElementById("productsContainer");
const generateRoutineButton = document.getElementById("generateRoutine");
const chatForm = document.getElementById("chatForm");
const chatWindow = document.getElementById("chatWindow");
const clearChatButton = document.getElementById("clearChatButton");
const userInput = document.getElementById("userInput");
const sendButton = document.getElementById("sendBtn");

/* Replace this example with the class Cloudflare Worker URL from your setup */
const WORKER_URL = "https://polished-meadow-4033.vinhtang21.workers.dev/";

/* Keep track of products on screen, selected products, and the conversation */
let displayedProducts = [];
let selectedProducts = [];
try {
  const savedProducts = localStorage.getItem("selectedProducts");

  if (savedProducts !== null) {
    const parsedProducts = JSON.parse(savedProducts);

    if (!Array.isArray(parsedProducts)) {
      throw new Error("Saved products must be a list.");
    }

    selectedProducts = parsedProducts;
  }
}
catch (error) {
  console.error("Could not load saved selected products:", error);
}

function saveSelectedProducts(){
  try {
    localStorage.setItem("selectedProducts", JSON.stringify(selectedProducts));
  }
  catch (error){
    console.error("Could not save selected products:", error);
  }
}

let routineGenerated = false;
const messages = [
  {
    role: "system",
    content:
    "You are a helpful L'Oréal beauty advisor. Use the conversation history to answer consistently. Answer questions about the generated routine and related beauty topics such as skincare, haircare, makeup, fragrance, and product use. If a question is unrelated, politely say you can help with the routine or beauty topics instead. Do not invent product ingredients or claims.",
  },
];

/* Show a placeholder until the user chooses a category */
productsContainer.innerHTML = `
  <div class="placeholder-message">
    Select a category to view products
  </div>
`;

/* Load the product data from the JSON file */
async function loadProducts() {
  const response = await fetch("products.json");

  if (!response.ok) {
    throw new Error(`Could not load products (status ${response.status}).`);
  }

  const data = await response.json();

  if (!Array.isArray(data.products)) {
    throw new Error("The product file does not contain a products list.");
  }

  return data.products;
}

/* Create product cards and keep the selected cards highlighted */
function displayProducts(products) {
  displayedProducts = products;

  productsContainer.innerHTML = products
    .map((product) => {
      const isSelected = selectedProducts.some(
        (item) => item.id === product.id
      );

      return `
        <div class="product-card ${isSelected ? "selected" : ""}">
          <button
            class="product-select"
            type="button"
            data-product-id="${product.id}"
            aria-pressed="${isSelected}"
          >
            <img src="${product.image}" alt="">
            <div class="product-info">
              <h3>${product.name}</h3>
              <p>${product.brand}</p>
            </div>
          </button>
          <details class="product-description">
            <summary>Product description</summary>
            <p>${product.description}</p>
          </details>
        </div>
      `;
    })
    .join("");
}

/* Refresh the selected products list */
function updateSelectedProducts() {
  selectedProductsList.innerHTML = selectedProducts
    .map(
      (product) => `
        <div class="selected-product-item">
          <span>${product.name}</span>
          <button
            type="button"
            class="remove-product"
            data-product-id="${product.id}"
            aria-label="Remove ${product.name}"
          >
            <i class="fa-solid fa-xmark"></i>
          </button>
        </div>
      `
    )
    .join("");
}
updateSelectedProducts();

/* Add a mesendMessageToAIssage to the chat without treating its text as HTML */
function addChatMessage(speaker, text, isError = false) {
  const messageElement = document.createElement("p");
  messageElement.className = isError
    ? "chat-message chat-message-error"
    : "chat-message";
  messageElement.textContent = `${speaker}: ${text}`;
  chatWindow.appendChild(messageElement);
  chatWindow.scrollTop = chatWindow.scrollHeight;
}

/* Send the conversation to the class Worker and show its reply */
async function sendMessageToAI(userMessage, showUserMessage = true) {
  messages.push({ role: "user", content: userMessage });

  if (showUserMessage) {
    addChatMessage("You", userMessage);
  }

  generateRoutineButton.disabled = true;
  sendButton.disabled = true;

  try {
    const response = await fetch(WORKER_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages }),
    });

    if (!response.ok) {
      throw new Error(`The AI service returned status ${response.status}.`);
    }

    const data = await response.json();
    const reply = data.choices?.[0]?.message?.content;

    if (typeof reply !== "string" || !reply.trim()) {
      throw new Error("The AI service returned an empty or unexpected reply.");
    }

    messages.push({ role: "assistant", content: reply });
    addChatMessage("Routine Advisor", reply);
    return true;
  } catch (error) {
    console.error("Could not get an AI response:", error);
    addChatMessage(
      "Error",
      `${error.message} Check the Worker URL and try again.`,
      true
    );
    return false; 
  } finally {
    generateRoutineButton.disabled = false;
    sendButton.disabled = false;
  }
}

/* Toggle a product when its card is clicked or activated from the keyboard */
function toggleProductSelection(productId) {
  const product = displayedProducts.find(
    (item) => String(item.id) === productId
  );

  if (!product) {
    return;
  }

  const isSelected = selectedProducts.some((item) => item.id === product.id);

  if (isSelected) {
    selectedProducts = selectedProducts.filter(
      (item) => item.id !== product.id
    );
  } else {
    selectedProducts.push(product);
  }
  saveSelectedProducts();
  displayProducts(displayedProducts);
  updateSelectedProducts();
}

productsContainer.addEventListener("click", (event) => {
  const selectButton = event.target.closest(".product-select");

  if (selectButton) {
    toggleProductSelection(selectButton.dataset.productId);
  }
});

/* Remove a product using the button in the selected products list */
selectedProductsList.addEventListener("click", (event) => {
  const removeButton = event.target.closest(".remove-product");

  if (!removeButton) {
    return;
  }

  selectedProducts = selectedProducts.filter(
    (product) => String(product.id) !== removeButton.dataset.productId
  );
  saveSelectedProducts();
  displayProducts(displayedProducts);
  updateSelectedProducts();
});

/* Filter products when the category changes */
categoryFilter.addEventListener("change", async (event) => {
  try {
    const products = await loadProducts();
    const filteredProducts = products.filter(
      (product) => product.category === event.target.value
    );

    displayProducts(filteredProducts);
  } catch (error) {
    console.error("Could not display products:", error);
    productsContainer.textContent = error.message;
  }
});

/* Ask the AI for a routine using only the products the user selected */
generateRoutineButton.addEventListener("click", async () => {
  if (selectedProducts.length === 0) {
    addChatMessage(
      "Note",
      "Select at least one product before generating a routine.",
      true
    );
    return;
  }

  const productDetails = selectedProducts.map(
    ({ name, brand, category, description }) => ({
      name,
      brand,
      category,
      description,
    })
  );

  const userMessage = `Create a personalized routine using only these selected products. Return the steps in the order they should be used, and explain when to use each one. Product data:\n${JSON.stringify(
    productDetails,
    null,
    2
  )}`;

const succeeded = await sendMessageToAI(userMessage, false);

if (succeeded){
    routineGenerated =  true;
}

});

/* Send follow-up questions with the existing conversation for context */
chatForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!routineGenerated){
    addChatMessage(
      "Note", "Generate a rountine before asking a follow-up question", true
    );
    return; 
  }
  const question = userInput.value.trim();

  if (!question) {
    return;
  }

  userInput.value = "";
  await sendMessageToAI(question);
});

clearSelectedProductsButton.addEventListener("click", () => {
  selectedProducts = [];
  saveSelectedProducts();
  updateSelectedProducts();
  displayProducts(displayedProducts);
});

/* Clear the chat and start a new conversation */
clearChatButton.addEventListener("click", () => {
  chatWindow.innerHTML = "";
  userInput.value = "";
  routineGenerated = false;

  // Keep the system instruction, but remove old user and assistant messages
  messages.splice(1);
});
