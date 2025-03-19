const PDFDocument = require('pdfkit');
const emailjs = require('@emailjs/nodejs');
const fs = require('fs');
const path = require('path');

const sendEmail = async (req, res) => {
    try {
        const { email, content, subject } = req.body;
        const userId = req.user._id;

        console.log('Starting email send process with:', { email, subject });

        // Clean the content before generating PDF
        const cleanContent = content.map(message => ({
            ...message,
            content: cleanTextFormatting(message.content)
        }));

        // Generate PDF
        const pdfPath = await generatePDF(cleanContent);
        console.log('PDF generated at:', pdfPath);

        // Convert PDF to base64
        const pdfBase64 = fs.readFileSync(pdfPath, { encoding: 'base64' });

        // Configure EmailJS with environment variables
        const emailjsConfig = {
            serviceId: process.env.EMAILJS_SERVICE_ID,
            templateId: process.env.EMAILJS_TEMPLATE_ID,
            publicKey: process.env.EMAILJS_PUBLIC_KEY,
            privateKey: process.env.EMAILJS_PRIVATE_KEY
        };

        console.log('EmailJS Configuration:', {
            serviceId: emailjsConfig.serviceId,
            templateId: emailjsConfig.templateId,
            hasPublicKey: !!emailjsConfig.publicKey,
            hasPrivateKey: !!emailjsConfig.privateKey
        });

        if (!emailjsConfig.serviceId || !emailjsConfig.templateId || 
            !emailjsConfig.publicKey || !emailjsConfig.privateKey) {
            throw new Error('EmailJS configuration is incomplete');
        }

        // Initialize EmailJS
        emailjs.init({
            publicKey: emailjsConfig.publicKey,
            privateKey: emailjsConfig.privateKey
        });

        // Prepare email template data
        const templateParams = {
            to_email: email,
            from_name: "AI Chat Assistant",
            subject: subject || 'Chat Summary',
            message: "Please find attached your chat summary.",
            pdf_content: pdfBase64
        };

        // Send email using EmailJS
        const emailResponse = await emailjs.send(
            emailjsConfig.serviceId,
            emailjsConfig.templateId,
            templateParams
        );

        console.log('EmailJS Response:', emailResponse);

        // Clean up PDF file
        fs.unlinkSync(pdfPath);

        res.json({ 
            success: true, 
            message: "Email sent successfully",
            response: emailResponse
        });

    } catch (error) {
        console.error('Detailed email send error:', error);
        
        let errorMessage = 'Error sending email';
        if (error.message.includes('configuration')) {
            errorMessage = 'Email service not properly configured';
        }

        res.status(500).json({ 
            success: false, 
            message: errorMessage,
            error: error.message
        });
    }
};

// Function to clean text formatting
const cleanTextFormatting = (text) => {
    return text
        .replace(/\*\*/g, '') // Remove bold markdown
        .replace(/\*/g, '')   // Remove italic markdown
        .replace(/`/g, '')    // Remove code markdown
        .replace(/\n\n/g, '\n') // Replace double newlines with single
        .replace(/\[|\]/g, '') // Remove square brackets
        .replace(/\(http[^)]+\)/g, '') // Remove URLs in parentheses
        .trim();
};

const generatePDF = async (content) => {
    return new Promise((resolve, reject) => {
        try {
            const doc = new PDFDocument();
            const pdfPath = path.join(__dirname, '../temp', `chat-${Date.now()}.pdf`);
            
            // Ensure temp directory exists
            if (!fs.existsSync(path.join(__dirname, '../temp'))) {
                fs.mkdirSync(path.join(__dirname, '../temp'));
            }

            const writeStream = fs.createWriteStream(pdfPath);
            doc.pipe(writeStream);

            // Add title
            doc.fontSize(16)
               .text('Chat Summary', {
                   align: 'center',
                   underline: true
               })
               .moveDown();

            // Add content to PDF with better formatting
            content.forEach(message => {
                // Add role header
                doc.fontSize(12)
                   .fillColor('#666666')
                   .text(message.role === 'user' ? 'You:' : 'Assistant:', {
                       align: 'left'
                   })
                   .moveDown(0.5);

                // Add message content
                doc.fontSize(11)
                   .fillColor('#000000')
                   .text(message.content, {
                       align: 'left',
                       indent: 20
                   })
                   .moveDown();
            });

            doc.end();

            writeStream.on('finish', () => {
                resolve(pdfPath);
            });

            writeStream.on('error', reject);
        } catch (error) {
            reject(error);
        }
    });
};

module.exports = { sendEmail }; 