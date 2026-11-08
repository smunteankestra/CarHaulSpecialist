export interface LegacySection {
  heading: string;
  paragraphs: string[];
}

export interface LegacyPage {
  title: string;
  description: string;
  intro: string;
  sections: LegacySection[];
}

export const LEGACY_PAGES: Record<string, LegacyPage> = {
  about: {
    title: "About Bond Auto Transport",
    description:
      "Nationwide car shipping with transparent pricing, licensed carriers and a real dispatcher on every order.",
    intro:
      "At Bond Auto Transport, we make vehicle shipping simple, secure, and stress-free. From pickup to delivery, your vehicle is handled with care by trusted professionals across the country.",
    sections: [
      {
        heading: "Reliable nationwide auto transport you can trust",
        paragraphs: [
          "Bond Auto Transport specializes in safe, reliable, and efficient vehicle shipping across all 50 states. Whether you are relocating, purchasing a vehicle online, shipping a car to family, or transporting a vehicle for business, our team works hard to ensure your vehicle reaches its destination safely and on time.",
          "Auto transport requires careful coordination, trusted carriers, and clear communication. Our goal is to simplify the vehicle shipping process so customers can ship their cars with confidence. From the moment you request a quote to the final delivery, we focus on dependable service, transparent pricing, and professional support.",
          "With a nationwide network of licensed and insured carriers, we connect customers with reliable drivers who specialize in transporting vehicles efficiently and securely.",
        ],
      },
      {
        heading: "Our story",
        paragraphs: [
          "Maxim Golovatiuc founded Bond Auto Transport in 2024 with a clear vision: to bring transparency, reliability, and personal service to the vehicle shipping industry.",
          "With years of hands-on experience in auto logistics starting in 2017, Maxim worked alongside some of America's largest transport operations and highly experienced car haulers. He saw where customers were experiencing frustration: unclear pricing, inconsistent communication, and unreliable service.",
          "Bond Auto Transport was created to bridge the gap between the scale of large corporate transport companies and the personalized service customers value. Today, we help individuals, families, dealerships, and businesses transport vehicles safely across the country.",
        ],
      },
      {
        heading: "Our mission",
        paragraphs: [
          "Our mission is to make vehicle shipping simple, transparent, and dependable for every customer.",
          "Total transparency: clear, honest pricing without hidden fees or confusing quotes. You know exactly what to expect.",
          "Proactive communication: you should never have to guess where your vehicle is. Our team keeps you informed throughout the process.",
          "Elite logistics: we partner with experienced, licensed, and insured carriers who meet strict safety and reliability standards.",
        ],
      },
      {
        heading: "Why customers choose Bond Auto Transport",
        paragraphs: [
          "Door-to-door service, transparent pricing, a real dispatcher on every order, fast pickups, online booking, digital inspections, qualified carriers, and support from pickup to delivery.",
          "We treat every vehicle as if it were our own, and we keep the process personal from the first quote to the final inspection.",
        ],
      },
    ],
  },
  reviews: {
    title: "Customer reviews",
    description: "Real Bond Auto Transport reviews from Yelp customers.",
    intro:
      "Customer satisfaction is one of our top priorities. Shipping a vehicle across the country requires trust, reliability, and clear communication, which is why we value the feedback shared by customers who have used our services.",
    sections: [
      {
        heading: "Cezar D. — Yelp, 7/17/25",
        paragraphs: [
          "\"I recently used Bond Auto Transport to ship my vehicle across the country, and I couldn't be happier with the experience. From the moment I reached out, their team was responsive, professional, and incredibly knowledgeable. They walked me through the entire process, answered all my questions, and gave me complete peace of mind.\"",
          "\"The pickup was exactly on schedule, and the driver was courteous and careful with my car. My vehicle arrived in perfect condition, right on time. Highly recommended to anyone looking for a hassle-free vehicle shipping experience!\"",
        ],
      },
      {
        heading: "BlackLimo S. — Yelp, 10/5/25",
        paragraphs: [
          "\"I'm glad I came across Bond Auto Transportation and hired them to ship my New Land Rover. They did a fantastic job! I got my vehicle in great condition. I loved that the driver was updating me every day with the ETA. The vehicle was super clean inside and they didn't mess it up.\"",
          "\"I hired them because I liked Max and his customer service, and I also got a really good deal on this shipment. I definitely recommend this company and will sure use them again in the future.\"",
        ],
      },
      {
        heading: "What our reviews say",
        paragraphs: [
          "Our team works hard to make the auto transport process simple and stress-free from start to finish. From providing clear quotes to coordinating pickup and delivery, we focus on dependable service and transparent communication.",
          "We partner with licensed and insured carriers who meet strict safety and reliability standards. By working with experienced drivers across our nationwide network, we ensure vehicles are transported securely and delivered with care.",
          "Whether customers are relocating, purchasing a vehicle from another state, or transporting a car for business purposes, their feedback helps us continue improving our services.",
        ],
      },
    ],
  },
  "our-partners": {
    title: "Our partners",
    description: "The licensed carrier network behind Bond Auto Transport.",
    intro:
      "We bridge the gap between reliability and reach. By maintaining an enclosed and open transport network, we provide clients with access to vetted auto carriers who meet our rigorous safety standards.",
    sections: [
      {
        heading: "Pro Carrier LLC",
        paragraphs: [
          "We work hand-in-hand with Pro Carrier LLC, owned by our founder's brother, Eugeniu Viscu. This family synergy allows us to offer professional vehicle logistics with a personal touch.",
          "Because we work so closely with the fleet owner, we can guarantee that our standards for safety and reliability are met on every single haul. From our family to yours, we treat every car as if it were our own.",
        ],
      },
      {
        heading: "Our fleet",
        paragraphs: [
          "9-car open trucks, 8-car open trucks, 5-car open trucks and 3-car open trucks.",
          "The network gives us the flexibility to handle single vehicles, dealer inventory, auction moves and multi-car shipments.",
        ],
      },
      {
        heading: "Carrier standards",
        paragraphs: [
          "Licensed and insured carriers only. Active insurance is checked before assignment, and we work with drivers who have proven delivery records.",
        ],
      },
    ],
  },
  "who-we-serve": {
    title: "Who we serve",
    description:
      "Nationwide vehicle shipping for individuals, families, dealerships, fleets, auctions and wholesale buyers.",
    intro:
      "Bond Auto Transport provides nationwide vehicle shipping for people and businesses who need fast pickup, clear communication, and reliable delivery with licensed and insured carriers across the U.S.",
    sections: [
      {
        heading: "Individuals and families",
        paragraphs: [
          "Moving, buying a car out of state, or shipping a vehicle to a new home? We make the process simple with door-to-door pickup and real dispatcher-reviewed quotes.",
          "Relocation and moves, online car purchases, student vehicles, military and PCS moves, and seasonal snowbird routes.",
        ],
      },
      {
        heading: "Dealerships and auto retailers",
        paragraphs: [
          "We help dealerships move inventory quickly and keep customers happy with dependable pickup windows and consistent updates.",
          "Dealer transfers, auction purchases and deliveries, customer deliveries, and overflow volume.",
        ],
      },
      {
        heading: "Owner-operators and small fleets",
        paragraphs: [
          "Need vehicles moved between regions or to customers? We coordinate transport with fast scheduling to keep your operation moving.",
          "Regional fleet repositioning, business vehicle moves, and small fleet dispatch support.",
        ],
      },
      {
        heading: "Auctions and wholesale buyers",
        paragraphs: [
          "Bought a vehicle from an auction or wholesale listing? We coordinate pickup and delivery with carriers experienced in auction locations and time windows.",
          "Auction yard pickup requirements, timing coordination, and multiple vehicle moves.",
        ],
      },
    ],
  },
  "transport-options": {
    title: "Transport options",
    description:
      "Compare open and enclosed vehicle transport, door-to-door service and expedited pickup from Bond Auto Transport.",
    intro:
      "Bond Auto Transport offers both open and enclosed car hauling options nationwide — each safe, insured, and tailored to your needs.",
    sections: [
      {
        heading: "Enclosed vehicle transport",
        paragraphs: [
          "The safest option for luxury, classic, and performance vehicles. Cars are fully protected inside a covered trailer, preventing exposure to weather, dust, and road debris.",
          "Fully enclosed, soft straps and wheel baskets, higher insured value, premium pricing, and limited but priority service.",
        ],
      },
      {
        heading: "Open vehicle transport",
        paragraphs: [
          "The most popular and affordable way to ship a vehicle. Open carriers are safe, efficient, and used for about 90% of all car shipments. Best for standard vehicles, daily drivers, and SUVs.",
          "Exposed to weather and road spray, standard coverage, most affordable, and widely available.",
        ],
      },
      {
        heading: "Enclosed vs open",
        paragraphs: [
          "Enclosed is ideal for luxury, classic, and exotic vehicles: fully enclosed, higher insured value, premium pricing, limited but priority service.",
          "Open is ideal for standard cars, SUVs, pickup trucks and vans: exposed to weather, standard coverage, most affordable, widely available.",
        ],
      },
      {
        heading: "Which option is right for you?",
        paragraphs: [
          "If you're shipping a standard or daily vehicle, open transport offers the best balance of safety and value. For collector, luxury, or show vehicles, enclosed shipping ensures full protection from all elements.",
        ],
      },
    ],
  },
};
