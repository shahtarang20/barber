const jwt = require("jsonwebtoken");
const http = require("http");

async function testApi() {
  const adminToken = jwt.sign(
    { userId: "dummyAdminId", role: "ADMIN" },
    process.env.JWT_SECRET || "fallback_secret",
    { expiresIn: "1d" }
  );

  const req = http.request("http://localhost:3000/api/admin/barbers", {
    method: "GET",
    headers: {
      "Cookie": `auth_token=${adminToken}`,
    }
  }, (res) => {
    let data = "";
    res.on("data", (chunk) => data += chunk);
    res.on("end", () => {
      console.log("Admin Barbers response:", data);
      
      const barbers = JSON.parse(data).data;
      if (barbers && barbers.length > 0) {
        const testBarber = barbers[0]._id;
        
        // Patch test
        const patchReq = http.request(`http://localhost:3000/api/admin/barbers/${testBarber}`, {
          method: "PATCH",
          headers: {
            "Cookie": `auth_token=${adminToken}`,
            "Content-Type": "application/json"
          }
        }, (res2) => {
          let data2 = "";
          res2.on("data", (chunk) => data2 += chunk);
          res2.on("end", () => {
            console.log("Patch Barber response:", data2);
            process.exit(0);
          });
        });

        patchReq.write(JSON.stringify({ premiumAmount: 1500, premiumDueDay: 10, isActive: false }));
        patchReq.end();
      }
    });
  });
  
  req.end();
}

testApi().catch(console.error);
