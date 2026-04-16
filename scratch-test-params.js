async function test() {
  const token = 'EAANiApjfrv4BRCZCZACq15F08df7eZB0OcCE5ZCvjDUaQOElZCM1UdDvCbP6awEZClxIAH5NKnFGP1zpisWC7ZCk0ZCMhAXhPnFZA78rkwbtzxkZBanqefALMbZAWUTPFZB7BaHuFZALvrgWDwkLcZBe6Olkyoudf3ZCptxd0Yia3HHzZAKjdraAPULsYm0Sfa8ZA8YGyXgZDZD';
  const phoneId = '1076272248900802';
  const url = `https://graph.facebook.com/v25.0/${phoneId}/messages`;

  const payload = {
    messaging_product: "whatsapp",
    to: "919211625495", 
    type: "template",
    template: {
      name: "welcome",
      language: {
        code: "en",
      },
      components: [
        {
          type: "body",
          parameters: [
            {
              type: "text",
              text: "John"
            }
          ]
        }
      ]
    },
  };

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });

  const data = await res.json();
  console.log("Response with 1 parameter:", JSON.stringify(data, null, 2));

  delete payload.template.components;
  const res2 = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });

  const data2 = await res2.json();
  console.log("Response with 0 parameters:", JSON.stringify(data2, null, 2));
}

test();
