import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('--- Starting RestroAstra Database Seed ---');

  // 1. Create Platform Super Admin
  const adminPasswordHash = await bcrypt.hash('adminpassword123', 10);
  const admin = await prisma.admin.upsert({
    where: { email: 'admin@restroastra.com' },
    update: {
      passwordHash: adminPasswordHash,
      name: 'RestroAstra Super Admin',
    },
    create: {
      email: 'admin@restroastra.com',
      passwordHash: adminPasswordHash,
      name: 'RestroAstra Super Admin',
    },
  });
  console.log(`Created/Verified Admin: ${admin.email}`);

  // 2. Create Demo Hotel matching the PDF mockup: "Sitan Dabaka Sekuwa Cornor"
  const hotelPasswordHash = await bcrypt.hash('password123', 10);
  const hotel = await prisma.hotel.upsert({
    where: { slug: 'sitan-dabaka-sekuwa' },
    update: {
      name: 'Sitan Dabaka Sekuwa Cornor',
      ownerEmail: 'sitan@sekuwacornor.com',
      passwordHash: hotelPasswordHash,
      phone: '9830382290',
      address: 'Banasthali, kharibote, kathmandu',
      status: 'active',
      coverImage: 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=1200&q=80',
    },
    create: {
      name: 'Sitan Dabaka Sekuwa Cornor',
      slug: 'sitan-dabaka-sekuwa',
      ownerEmail: 'sitan@sekuwacornor.com',
      passwordHash: hotelPasswordHash,
      phone: '9830382290',
      address: 'Banasthali, kharibote, kathmandu',
      status: 'active',
      coverImage: 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=1200&q=80',
    },
  });
  console.log(`Created/Verified Hotel: ${hotel.name} (slug: ${hotel.slug})`);

  // Also create a second hotel to showcase multi-tenancy: "Himalayan View Bistro"
  const hotel2 = await prisma.hotel.upsert({
    where: { slug: 'himalayan-view-bistro' },
    update: {
      name: 'Himalayan View Bistro & Lounge',
      ownerEmail: 'manager@himalayanbistro.com',
      passwordHash: hotelPasswordHash,
      phone: '9841234567',
      address: 'Lakeside-6, Pokhara',
      status: 'active',
      coverImage: 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=1200&q=80',
    },
    create: {
      name: 'Himalayan View Bistro & Lounge',
      slug: 'himalayan-view-bistro',
      ownerEmail: 'manager@himalayanbistro.com',
      passwordHash: hotelPasswordHash,
      phone: '9841234567',
      address: 'Lakeside-6, Pokhara',
      status: 'active',
      coverImage: 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=1200&q=80',
    },
  });
  console.log(`Created/Verified Hotel 2: ${hotel2.name}`);

  // 3. Clear existing menu items for clean seed
  await prisma.menuItem.deleteMany({
    where: { hotelId: hotel.id },
  });

  // 4. Create Menu Items matching the PDF mockup categories
  const menuItems = [
    // SNACKS (Page 6 in PDF)
    {
      hotelId: hotel.id,
      category: 'SNAKS,CUISINE',
      name: 'Special Mutton Sekuwa (मटन सेकुवा)',
      price: 550,
      imageUrl: 'https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=800&q=80',
      description: 'Charcoal-grilled tender mutton cubes marinated in traditional Himalayan herbs & roasted mustard oil.',
      isAvailable: true,
      is3dEnabled: true,
    },
    {
      hotelId: hotel.id,
      category: 'SNAKS,CUISINE',
      name: 'Chicken Sekuwa Platter (चिकेन सेकुवा)',
      price: 420,
      imageUrl: 'https://images.unsplash.com/photo-1555939594-58d7cb561ad1?auto=format&fit=crop&w=800&q=80',
      description: 'Juicy skewered chicken char-grilled to perfection, served with bhatmas sandheko and spicy tomato golbheda ko achar.',
      isAvailable: true,
      is3dEnabled: false,
    },
    {
      hotelId: hotel.id,
      category: 'SNAKS,CUISINE',
      name: 'Pork Sekuwa Special (पोर्क सेकुवा)',
      price: 480,
      imageUrl: 'https://images.unsplash.com/photo-1529193591184-b1d58069ecdd?auto=format&fit=crop&w=800&q=80',
      description: 'Authentic Dharane style pork sekuwa seasoned with timur (Sichuan pepper) and local spices.',
      isAvailable: true,
      is3dEnabled: false,
    },
    {
      hotelId: hotel.id,
      category: 'SNAKS,CUISINE',
      name: 'Buff Sukuti Sandheko (सुकुटी साँधेको)',
      price: 390,
      imageUrl: 'https://images.unsplash.com/photo-1563245372-f21724e3856d?auto=format&fit=crop&w=800&q=80',
      description: 'Crispy dry meat tossed with fresh onion, garlic, ginger, roasted mustard oil, green chillies & fresh coriander.',
      isAvailable: true,
      is3dEnabled: false,
    },
    {
      hotelId: hotel.id,
      category: 'SNAKS,CUISINE',
      name: 'Chicken C-Momo (चिकेन सि-मोमो)',
      price: 320,
      imageUrl: 'https://images.unsplash.com/photo-1625398407796-82650a8c135f?auto=format&fit=crop&w=800&q=80',
      description: 'Spicy pan-fried chicken dumplings tossed in a rich, tangy bell pepper and chilli gravy.',
      isAvailable: true,
      is3dEnabled: false,
    },
    {
      hotelId: hotel.id,
      category: 'SNAKS,CUISINE',
      name: 'Crispy Fried Chicken Momo (फ्राइड मोमो)',
      price: 280,
      imageUrl: 'https://images.unsplash.com/photo-1534422298391-e4f8c172dddb?auto=format&fit=crop&w=800&q=80',
      description: 'Crisp golden momos served with rich homemade sesame and roasted tomato dipping sauces.',
      isAvailable: true,
      is3dEnabled: false,
    },
    {
      hotelId: hotel.id,
      category: 'SNAKS,CUISINE',
      name: 'Paneer Chilli Dry (पनिर चिल्ली)',
      price: 380,
      imageUrl: 'https://images.unsplash.com/photo-1567188040759-fb8a883dc6d8?auto=format&fit=crop&w=800&q=80',
      description: 'Fresh cottage cheese stir-fried with crisp onions, capsicum, ginger-garlic paste and dark soya glaze.',
      isAvailable: true,
      is3dEnabled: false,
    },
    {
      hotelId: hotel.id,
      category: 'SNAKS,CUISINE',
      name: 'Crispy Chicken Wings (चिकेन विङ्ग्स)',
      price: 450,
      imageUrl: 'https://images.unsplash.com/photo-1527477396000-e27163b481c2?auto=format&fit=crop&w=800&q=80',
      description: 'Deep fried crispy wings coated in spicy honey-sesame glaze.',
      isAvailable: true,
      is3dEnabled: false,
    },

    // CUISINE & MAINS
    {
      hotelId: hotel.id,
      category: 'SNAKS,CUISINE',
      name: 'Authentic Thakali Khana Set (थकाली खाना सेट)',
      price: 650,
      imageUrl: 'https://images.unsplash.com/photo-1610057099443-fde8c4d50f91?auto=format&fit=crop&w=800&q=80',
      description: 'Complete Nepali feast with aromatic Basmati rice, black Himalayan dal, local chicken curry, saag, gundruk achar & ghee.',
      isAvailable: true,
      is3dEnabled: false,
    },
    {
      hotelId: hotel.id,
      category: 'SNAKS,CUISINE',
      name: 'Sekuwa Fried Rice (सेकुवा फ्राइड राइस)',
      price: 360,
      imageUrl: 'https://images.unsplash.com/photo-1603133872878-684f208fb84b?auto=format&fit=crop&w=800&q=80',
      description: 'Wok-tossed basmati rice with smokey char-grilled chicken sekuwa pieces, scrambled eggs, and spring greens.',
      isAvailable: true,
      is3dEnabled: false,
    },

    // DRINKS (Page 7 in PDF)
    {
      hotelId: hotel.id,
      category: 'DRINK',
      name: 'Barahsinghe Craft Beer (६५०ml)',
      price: 520,
      imageUrl: 'https://images.unsplash.com/photo-1608270586620-248524c67de9?auto=format&fit=crop&w=800&q=80',
      description: 'Crisp Nepali craft pilsner brewed with imported German hops and Himalayan spring water.',
      isAvailable: true,
      is3dEnabled: false,
    },
    {
      hotelId: hotel.id,
      category: 'DRINK',
      name: 'Gorkha Strong Beer (६५०ml)',
      price: 490,
      imageUrl: 'https://images.unsplash.com/photo-1535958636474-b021ee887b13?auto=format&fit=crop&w=800&q=80',
      description: 'Premium malt beverage with smooth body and rich golden finish.',
      isAvailable: true,
      is3dEnabled: false,
    },
    {
      hotelId: hotel.id,
      category: 'DRINK',
      name: 'Khukri XXX Rum (६०ml peg)',
      price: 350,
      imageUrl: 'https://images.unsplash.com/photo-1514362545857-3bc16c4c7d1b?auto=format&fit=crop&w=800&q=80',
      description: 'The legendary dark Himalayan oak-matured spiced rum, served neat or with cola & lemon.',
      isAvailable: true,
      is3dEnabled: false,
    },
    {
      hotelId: hotel.id,
      category: 'DRINK',
      name: 'Himalayan Blue Lagoon Cocktail',
      price: 420,
      imageUrl: 'https://images.unsplash.com/photo-1551024709-8f23befc6f87?auto=format&fit=crop&w=800&q=80',
      description: 'Refreshing blend of blue curaçao, vodka, fresh lime juice and lemon soda served over crushed ice.',
      isAvailable: true,
      is3dEnabled: false,
    },
    {
      hotelId: hotel.id,
      category: 'DRINK',
      name: 'Himalayan Masala Milk Tea (स्पेशल चिया)',
      price: 90,
      imageUrl: 'https://images.unsplash.com/photo-1576092768241-dec231879fc3?auto=format&fit=crop&w=800&q=80',
      description: 'Fresh cow milk brewed with Ilam orthodox tea leaves, crushed ginger, cardamom, and cinnamon.',
      isAvailable: true,
      is3dEnabled: false,
    },

    // SPECIALS & COMBO PLATTERS
    {
      hotelId: hotel.id,
      category: 'SNAKS,CUISINE',
      name: 'Executive Sekuwa Night Platter (सेकुवा कम्बो)',
      price: 1250,
      imageUrl: 'https://images.unsplash.com/photo-1590846406792-0adc7f938f1d?auto=format&fit=crop&w=800&q=80',
      description: 'Grand dining platter: Mutton Sekuwa + Chicken Choila + Sadheko Bhatmas + 2 Chilled Beverages.',
      isAvailable: true,
      is3dEnabled: false,
    },
    {
      hotelId: hotel.id,
      category: 'SNAKS,CUISINE',
      name: 'Late Night Biryani & Sekuwa Combo (दम बिर्यानी सेट)',
      price: 950,
      imageUrl: 'https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?auto=format&fit=crop&w=800&q=80',
      description: 'Full handi chicken dum biryani served with raita, spicy sekuwa sticks, and sweet gulab jamun.',
      isAvailable: true,
      is3dEnabled: false,
    },
    {
      hotelId: hotel.id,
      category: 'SNAKS,CUISINE',
      name: 'Candlelight Date Sizzler Special (क्यान्डललाइट डिनर)',
      price: 1800,
      imageUrl: 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=800&q=80',
      description: 'Complete dinner package with sizzling mixed grill, candle setting, and premium drinks.',
      isAvailable: true,
      is3dEnabled: false,
    },

    // BED ROOM / HOTEL ROOMS (Page 8 in PDF)
    {
      hotelId: hotel.id,
      category: 'BED ROOM',
      name: 'Deluxe AC King Bedroom (डिलक्स बेड रुम)',
      price: 2500,
      imageUrl: 'https://images.unsplash.com/photo-1590490360182-c33d57733427?auto=format&fit=crop&w=800&q=80',
      description: 'Spacious air-conditioned deluxe bedroom with plush king bed, attached luxury bathroom, high-speed WiFi & 24/7 room service.',
      isAvailable: true,
      is3dEnabled: false,
    },
    {
      hotelId: hotel.id,
      category: 'BED ROOM',
      name: 'Executive Suite Room (एक्जिक्युटिभ सुइट)',
      price: 3800,
      imageUrl: 'https://images.unsplash.com/photo-1566665797739-1674de7a421a?auto=format&fit=crop&w=800&q=80',
      description: 'Premium master bedroom suite featuring balcony views, private living lounge, smart LED TV, and complimentary breakfast.',
      isAvailable: true,
      is3dEnabled: false,
    },
    {
      hotelId: hotel.id,
      category: 'BED ROOM',
      name: 'Standard Double Bedroom (स्ट्यान्डर्ड बेड रुम)',
      price: 1800,
      imageUrl: 'https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?auto=format&fit=crop&w=800&q=80',
      description: 'Comfortable, quiet standard hotel room with fresh double linens, hot/cold shower, tea maker, and prompt room service.',
      isAvailable: true,
      is3dEnabled: false,
    },
  ];

  for (const item of menuItems) {
    await prisma.menuItem.create({
      data: item,
    });
  }
  console.log(`Inserted ${menuItems.length} menu items for ${hotel.name}`);

  // 5. Create a sample initial order & feedback for demo showcase
  const sampleOrder = await prisma.order.create({
    data: {
      hotelId: hotel.id,
      tableNumber: '1',
      customerName: 'Aarav Sharma',
      customerPhone: '9801234567',
      items: JSON.stringify([
        { id: '1', name: 'Special Mutton Sekuwa (मटन सेकुवा)', price: 550, quantity: 2, notes: 'Extra spicy timur' },
        { id: '2', name: 'Barahsinghe Craft Beer (६५०ml)', price: 520, quantity: 2 },
      ]),
      totalAmount: 2140,
      status: 'done',
      notes: 'Table 1 - Near window',
    },
  });

  await prisma.chatMessage.createMany({
    data: [
      {
        hotelId: hotel.id,
        orderId: sampleOrder.id,
        sender: 'customer',
        message: 'Namaste! Please make the mutton sekuwa extra spicy with fresh green chillies.',
      },
      {
        hotelId: hotel.id,
        orderId: sampleOrder.id,
        sender: 'staff',
        message: 'Namaste Aarav ji! Sure, our chef has noted it and is grilling it fresh for Table 1.',
      },
    ],
  });

  await prisma.feedback.create({
    data: {
      hotelId: hotel.id,
      orderId: sampleOrder.id,
      rating: 5,
      comment: 'Top notch quality and authentic taste! The live chat and QR order is super fast and modern.',
      customerName: 'Aarav Sharma',
    },
  });

  // Create an active in-progress order for demo
  await prisma.order.create({
    data: {
      hotelId: hotel.id,
      tableNumber: '4',
      customerName: 'Pooja Thapa',
      customerPhone: '9847654321',
      items: JSON.stringify([
        { id: '3', name: 'Chicken C-Momo (चिकेन सि-मोमो)', price: 320, quantity: 2 },
        { id: '4', name: 'Himalayan Masala Milk Tea (स्पेशल चिया)', price: 90, quantity: 2 },
      ]),
      totalAmount: 820,
      status: 'in_progress',
      notes: 'Less oil please',
    },
  });

  console.log('--- Database Seeding Complete! ---');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
