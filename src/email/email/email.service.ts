import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Transporter } from 'nodemailer';
import * as nodemailer from 'nodemailer';
import * as fs from 'fs';
import * as path from 'path';
import { OTP_EXPIRATION } from 'src/utils/const.utils';
import { Logger } from 'winston';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';

@Injectable()
export class EmailService {
  private transporter: Transporter;

  constructor(
    @Inject(WINSTON_MODULE_PROVIDER) private logger: Logger,
    private configService: ConfigService,
  ) {
    this.transporter = nodemailer.createTransport({
      host: this.configService.get<string>('EMAIL_HOST'),
      port: this.configService.get<number>('EMAIL_PORT'),
      secure:
        this.configService.get<number>('EMAIL_SECURE') === 1 ? true : false,
      auth: {
        user: this.configService.get<string>('EMAIL_USER'),
        pass: this.configService.get<string>('EMAIL_PASSWORD'),
      },
    });
  }

  async sendOTP(email: string, otp: string): Promise<void> {
    const template = this.readTemplate('otp-email-template');

    const htmlContent = this.replaceTemplate(template, {
      OTP: otp,
      OTP_EXPIRATION: (OTP_EXPIRATION / 60 / 1000).toString(),
    });

    const mailOptions = {
      from: this.configService.get<string>('EMAIL_USER'),
      to: email,
      subject: 'Your OTP Code',
      html: htmlContent,
    };

    try {
      await this.transporter.sendMail(mailOptions);
      this.logger.info(`OTP email sent successfully to ${email}`);
    } catch (error) {
      this.logger.error('Error sending email:', error);
      throw new Error('Failed to send OTP email');
    }
  }

  async verifyConnection(): Promise<boolean> {
    try {
      await this.transporter.verify();
      this.logger.info('Email server is ready to send messages');
      return true;
    } catch (error) {
      this.logger.error('Email server connection failed:', error);
      return false;
    }
  }

  // Method untuk membaca template HTML
  private readTemplate(templateName: string): string {
    this.logger.debug('Dirname: ', __dirname);
    const isDist = __dirname.includes('dist');
    const templatePath = path.join(
      process.cwd(),
      ...(isDist ? ['dist', 'src'] : ['src']),
      'email',
      'templates',
      `${templateName}.html`,
    );

    try {
      return fs.readFileSync(templatePath, 'utf-8');
    } catch (error) {
      this.logger.error(`Error reading template ${templateName}:`, error);
      throw new Error(`Template ${templateName} not found`);
    }
  }

  // Method untuk replace placeholder di template
  private replaceTemplate(
    template: string,
    data: Record<string, string>,
  ): string {
    let result = template;

    for (const [key, value] of Object.entries(data)) {
      const placeholder = new RegExp(`{{${key}}}`, 'g');
      result = result.replace(placeholder, value);
    }

    return result;
  }
}
