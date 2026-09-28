import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

async function runE2E() {
  const randomStr = Math.random().toString(36).substring(7);
  const email = `e2e-${randomStr}@example.com`;
  const slug = `e2e-barber-${randomStr}`;
  console.log("1. Registering new barber...");
  const regRes = await fetch("http://localhost:3000/api/auth/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: "E2E Barber",
      email: email,
      password: "password123",
      slug: slug
    })
  });
  const regData = await regRes.json();
  console.log("Register Response:", regData);

  console.log("1.5 Logging in...");
  const loginRes = await fetch("http://localhost:3000/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ barberCode: regData.data.barberCode, password: "password123" })
  });
  const setCookies = loginRes.headers.getSetCookie ? loginRes.headers.getSetCookie() : [];
  let token = "";
  for (const cookie of setCookies) {
    const match = cookie.match(/auth_token=([^;]+)/);
    if (match) token = match[1];
  }
  if (!token) {
    const fallback = loginRes.headers.get("set-cookie") || "";
    const match = fallback.match(/auth_token=([^;]+)/);
    if (match) token = match[1];
  }
  console.log("Got token length:", token.length);

  console.log("2. Generating slots...");
  const todayDateStr = new Date().toISOString().split('T')[0];
  const slotsRes = await fetch("http://localhost:3000/api/barber/slots/generate", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Cookie": `auth_token=${token}`
    },
    body: JSON.stringify({ date: todayDateStr })
  });
  const slotsData = await slotsRes.json();
  console.log("Slots Response:", slotsData.success ? `${slotsData.data.length} slots generated` : slotsData);

  console.log("3. Fetching public slots as customer...");
  const pubRes = await fetch(`http://localhost:3000/api/public/barbers/${slug}/slots?date=` + new Date().toISOString().split('T')[0]);
  const pubData = await pubRes.json();
  
  if (!pubData.data || pubData.data.length === 0) {
    console.log("No public slots found!");
    return;
  }
  const targetSlot = pubData.data[0];
  console.log("Target slot:", targetSlot.startTime);

  console.log("4. Booking slot...");
  const bookRes = await fetch("http://localhost:3000/api/public/bookings", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      barberId: targetSlot.barberId,
      slotId: targetSlot._id,
      name: "John Test",
      phone: "1234567890",
      notes: "Test booking"
    })
  });
  const bookData = await bookRes.json();
  console.log("Booking Response:", bookData);

  console.log("5. Checking Barber Appointments Dashboard...");
  const appRes = await fetch("http://localhost:3000/api/barber/bookings", {
    headers: { "Cookie": `auth_token=${token}` }
  });
  const appData = await appRes.json();
  console.log("Appointments Response:", appData.success ? `Found ${appData.data.length} appointments` : appData);
  
  if (appData.success && appData.data.length > 0 && appData.data[0].customerId.name === "John Test") {
    console.log("✅ End-to-End flow works perfectly!");
  } else {
    console.log("❌ End-to-End flow failed.");
  }
}

runE2E().catch(console.error);
